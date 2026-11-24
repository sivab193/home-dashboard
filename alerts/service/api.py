"""Small HTTP API the dashboard polls for events and per-camera state."""
import json
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .diorama import DioramaStore
from .stocks import StockQuotes


class HomeCommand(BaseModel):
    action: str
    data: dict = Field(default_factory=dict)


class HomeEntityCreate(BaseModel):
    entity_id: str
    name: str | None = None
    room: str | None = None
    icon: str | None = None


class HomeEntityEdit(BaseModel):
    name: str | None = None
    room: str | None = None
    icon: str | None = None
    device_name: str | None = None


class RoomName(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class MusicClaim(BaseModel):
    client_id: str = Field(min_length=8, max_length=120)
    name: str = Field(default="This device", max_length=60)
    take_over: bool = False


class MusicLevel(BaseModel):
    client_id: str = Field(min_length=8, max_length=120)
    level: float = Field(ge=0, le=1)
    beat: bool = False
    hue: int = Field(default=210, ge=0, le=359)


class MacMusicCommand(BaseModel):
    action: str


def build_app(bus, monitor, snapshot_dir: Path, home=None, music=None,
              diorama_default: Path | None = None, mac=None, calendar=None) -> FastAPI:
    app = FastAPI(title="cctv-alerts")
    stocks = StockQuotes()
    dock_config_path = snapshot_dir / "dockspace-config.json"
    dock_config_defaults = {
        "userName": "Sarvesh",
        "studioName": "Illam",
        "autoHideDock": True,
        "activeMacTarget": "Mac",
        "workShiftHours": "9:00 AM - 5:00 PM",
        "clockFormat": "12-hour",
        "cloudSync": True,
        "dockOpacity": 85,
        "showWeatherOverlay": True,
        "widgetDisplayName": "Mac",
        "widgetGridSpan": "2x4 Medium",
        "weatherCity": "West Lafayette, Indiana",
        "weatherLat": 40.4259,
        "weatherLon": -86.9081,
        "stockSymbols": "AAPL,NVDA,V,GOOG,META,TSLA",
        "worldClocks": [
            {"label": "West Lafayette", "timeZone": "America/Indiana/Indianapolis"},
            {"label": "New York", "timeZone": "America/New_York"},
            {"label": "London", "timeZone": "Europe/London"},
            {"label": "Bengaluru", "timeZone": "Asia/Kolkata"},
            {"label": "Tokyo", "timeZone": "Asia/Tokyo"},
        ],
        "homeQuickDeviceIds": [],
    }

    def read_dock_config() -> dict:
        if dock_config_path.is_file():
            try:
                saved = json.loads(dock_config_path.read_text())
                if isinstance(saved, dict):
                    return {**dock_config_defaults, **saved}
            except (json.JSONDecodeError, OSError):
                pass
        return dict(dock_config_defaults)

    def write_dock_config(patch: dict) -> dict:
        config = read_dock_config()
        for key, value in patch.items():
            if key in dock_config_defaults:
                config[key] = value
        dock_config_path.parent.mkdir(parents=True, exist_ok=True)
        dock_config_path.write_text(json.dumps(config, indent=2))
        return config

    @app.get('/api/dashboard/stocks')
    async def stock_quotes(symbols: str = 'AAPL,NVDA,V,GOOG,META,TSLA'):
        try:
            return await stocks.quotes(symbols)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    diorama = DioramaStore(snapshot_dir / "diorama.json", diorama_default)
    # trusted LAN only; the dashboard is served from :1984, a different origin
    app.add_middleware(CORSMiddleware, allow_origins=["*"],
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Content-Type"])

    @app.get("/api/events")
    def events(limit: int = 50):
        return bus.recent(min(limit, 200))

    @app.get("/api/health")
    def health():
        return monitor.snapshot_states()

    @app.get("/api/snapshots/{name}")
    def snapshot(name: str):
        p = (snapshot_dir / name).resolve()
        if p.parent != snapshot_dir.resolve() or not p.is_file():
            return JSONResponse({"error": "not found"}, status_code=404)
        return FileResponse(p, media_type="image/jpeg")

    @app.get("/api/home/config")
    def home_config():
        return home.public_config() if home else {"enabled": False, "configured": False, "entities": []}

    @app.get("/api/home/states")
    def home_states():
        if not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return home.states()
        except (httpx.HTTPError, RuntimeError) as exc:
            raise HTTPException(status_code=502, detail="A home device provider is unreachable") from exc

    @app.get("/api/home/diorama")
    def home_diorama():
        try:
            return diorama.load()
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=500, detail="The saved home model could not be read") from exc

    @app.put("/api/home/diorama")
    def home_save_diorama(payload: dict):
        try:
            return diorama.save(payload)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OSError as exc:
            raise HTTPException(status_code=500, detail="The home model could not be saved") from exc

    @app.post("/api/home/entities/{item_id}")
    def home_command(item_id: str, command: HomeCommand):
        if not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return home.command(item_id, command.action, command.data)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Unknown device") from exc
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except (httpx.HTTPError, RuntimeError) as exc:
            raise HTTPException(status_code=502, detail="Device command failed") from exc

    @app.post("/api/home/entities")
    def home_add_entity(entity: HomeEntityCreate):
        if not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return home.add_entity(entity.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.patch("/api/home/entities/{item_id}")
    def home_edit_entity(item_id: str, entity: HomeEntityEdit):
        if not home:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return home.update_entity(item_id, entity.model_dump(exclude_unset=True))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Unknown device") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.delete("/api/home/entities/{item_id}")
    def home_remove_entity(item_id: str):
        if not home:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            home.remove_entity(item_id)
            return {"ok": True}
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Unknown device") from exc

    @app.post("/api/home/rooms")
    def home_add_room(room: RoomName):
        if not home:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return {"rooms": home.add_room(room.name)}
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.patch("/api/home/rooms/{room}")
    def home_rename_room(room: str, payload: RoomName):
        if not home:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return {"rooms": home.rename_room(room, payload.name)}
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/home/rooms/{room}/turn_off")
    def home_turn_off_room(room: str):
        if not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        return home.turn_off_room(room)

    @app.post("/api/home/rooms/{room}/turn_on")
    def home_turn_on_room(room: str):
        if not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        return home.turn_on_room(room)

    @app.get("/api/home/music-reactive")
    def music_status():
        return music.status() if music and home and home.enabled else {"active": False, "available": False}

    @app.post("/api/home/music-reactive/claim")
    def music_claim(request: MusicClaim):
        if not music or not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return music.claim(request.client_id, request.name, request.take_over)
        except PermissionError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/home/music-reactive/level")
    def music_level(level: MusicLevel):
        if not music or not home or not home.enabled:
            raise HTTPException(status_code=503, detail="Home Assistant is not configured")
        try:
            return music.update(level.client_id, level.level, level.beat, level.hue)
        except PermissionError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Home Assistant command failed") from exc

    @app.post("/api/home/music-reactive/stop")
    def music_stop(request: MusicClaim):
        if not music:
            raise HTTPException(status_code=503, detail="Music reactive mode is unavailable")
        try:
            return music.stop(request.client_id, request.take_over)
        except PermissionError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get("/api/dashboard/mac/music")
    def mac_music_status():
        return mac.music_status() if mac else {"available": False, "state": "unsupported"}

    @app.post("/api/dashboard/mac/music")
    def mac_music_command(command: MacMusicCommand):
        if not mac:
            raise HTTPException(status_code=503, detail="Mac controls are unavailable")
        try:
            return mac.music_command(command.action)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/config")
    def dock_config_status():
        return read_dock_config()

    @app.patch("/api/config")
    def dock_config_update(patch: dict):
        return write_dock_config(patch)

    @app.post("/api/config/reset")
    def dock_config_reset():
        if dock_config_path.is_file():
            dock_config_path.unlink()
        return dict(dock_config_defaults)

    def media_snapshot():
        raw = mac.music_status() if mac else {"available": False, "state": "unsupported"}
        available = bool(raw.get("available"))
        state = str(raw.get("state") or "stopped").lower()
        playing = state in {"playing", "play"}
        duration = int(raw.get("duration") or 0)
        if raw.get("source") == "Spotify" and duration > 1000:
            duration = duration // 1000
        position = int(raw.get("position") or 0)
        title = str(raw.get("title") or "").strip()
        artist = str(raw.get("artist") or "").strip()
        source = str(raw.get("browser") or raw.get("source") or "Mac")
        if not available:
            title = "No active playback"
            artist = "Open Apple Music, Spotify, or YouTube Music"
        return {
            "playing": playing,
            "shuffle": False,
            "repeat": "off",
            "volume": 68,
            "positionSec": position,
            "outputZone": "mac",
            "outputLabel": "Mac",
            "source": source,
            "trackId": "mac-now-playing",
            "track": {
                "id": "mac-now-playing",
                "title": title,
                "artist": artist,
                "album": source,
                "quality": "System playback",
                "accent": "#ff6370",
                "durationSec": duration,
            },
            "queue": [],
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

    @app.get("/api/media")
    def media_status():
        return media_snapshot()

    @app.post("/api/media/control")
    def media_control(command: dict):
        action = str(command.get("action") or "").strip().lower()
        if action in {"toggle", "play_pause", "play", "pause", "next", "prev", "previous"}:
            if action == "play":
                action = "toggle"
            if action == "pause":
                action = "toggle"
            try:
                mac.music_command(action)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except RuntimeError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            return media_snapshot()
        raise HTTPException(status_code=400, detail="Unsupported media control action")

    @app.get("/api/dashboard/mac/calendar")
    def mac_calendar_events(days: int = 14):
        return mac.calendar_events(max(1, min(days, 31))) if mac else {"available": False, "events": []}

    @app.get("/api/dashboard/calendar")
    def calendar_feed_status():
        return calendar.status() if calendar else {"configured": False, "events": [], "notifications": [], "unread": 0}

    @app.post("/api/dashboard/calendar/read")
    def calendar_feed_mark_read():
        if not calendar:
            raise HTTPException(status_code=503, detail="Calendar feed is unavailable")
        return calendar.mark_read()

    return app
