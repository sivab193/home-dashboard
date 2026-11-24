"""Small, local-only bridge for YouTube Music and Calendar on macOS.

The dashboard service runs on the Mac that owns these apps. AppleScript is
kept behind fixed, allow-listed operations so browser clients never execute
arbitrary scripts or shell commands.
"""
from __future__ import annotations

import platform
import subprocess
from datetime import datetime
from typing import Any


class MacBridge:
    YOUTUBE_MUSIC_ACTIONS = {
        "play_pause": "const v=document.querySelector('video');if(v){v.paused?v.play():v.pause();'ok'}else{'no_player'}",
        "next": "const b=document.querySelector('#next-button,.next-button');if(b){b.click();'ok'}else{'no_button'}",
        "previous": "const b=document.querySelector('#previous-button,.previous-button');if(b){b.click();'ok'}else{'no_button'}",
    }
    YOUTUBE_MUSIC_STATUS = """(()=>{const v=document.querySelector('video');const t=document.querySelector('ytmusic-player-bar .title');const a=document.querySelector('ytmusic-player-bar .byline');return [v?(v.paused?'paused':'playing'):'stopped',t?.textContent?.trim()||'',a?.textContent?.trim()||''].join('\\u001f')})()"""

    @property
    def available(self) -> bool:
        return platform.system() == "Darwin"

    @staticmethod
    def _run(lines: list[str], timeout: float = 4.0) -> str:
        command = ["osascript"]
        for line in lines:
            command.extend(["-e", line])
        completed = subprocess.run(
            command, capture_output=True, text=True, timeout=timeout, check=False)
        if completed.returncode:
            message = completed.stderr.strip() or "macOS automation failed"
            raise RuntimeError(message)
        return completed.stdout.strip()

    def music_status(self) -> dict[str, Any]:
        if not self.available:
            return {"available": False, "state": "unsupported"}
        try:
            result = self._youtube_tab_script(self.YOUTUBE_MUSIC_STATUS)
            if result == "not_open":
                return self._native_music_status()
            parts = (result + "\x1f\x1f").split("\x1f")
            return {"available": True, "state": parts[0], "title": parts[1],
                    "artist": parts[2], "browser": "Brave Browser"}
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            native = self._native_music_status()
            if native["available"]:
                return native
            return {"available": False, "state": "setup_required",
                    "browser": "Brave Browser", "error": str(exc)}

    def music_command(self, action: str) -> dict[str, Any]:
        if not self.available:
            raise RuntimeError("YouTube Music controls are available only on macOS")
        if action not in {"play_pause", "toggle", "next", "previous", "prev", "play", "pause"}:
            raise ValueError("unsupported YouTube Music action")
        javascript = self.YOUTUBE_MUSIC_ACTIONS.get({
            "toggle": "play_pause",
            "play": "play_pause",
            "pause": "play_pause",
            "prev": "previous",
        }.get(action, action))
        if not javascript:
            raise ValueError("unsupported YouTube Music action")
        try:
            result = self._youtube_tab_script(javascript)
        except RuntimeError:
            result = "not_open"
        if result == "not_open":
            native = self._native_music_status()
            if native["available"]:
                native_action = {
                    "toggle": "play_pause",
                    "play_pause": "play_pause",
                    "play": "play_pause",
                    "pause": "play_pause",
                    "next": "next",
                    "previous": "previous",
                    "prev": "previous",
                }[action]
                if self._native_music_command(native_action, native["source"]):
                    return self.music_status()
            raise RuntimeError("Open music.youtube.com or a native macOS music app")
        if result in {"no_player", "no_button"}:
            raise RuntimeError("YouTube Music player controls were not found")
        return self.music_status()

    def _native_music_status(self) -> dict[str, Any]:
        apps = (
            ("Music", "Apple Music"),
            ("Spotify", "Spotify"),
        )
        for app_name, label in apps:
            try:
                if app_name == "Music":
                    script = [
                        f'if application "{app_name}" is running then',
                        f'tell application "{app_name}"',
                        'set trackName to name of current track',
                        'set trackArtist to artist of current track',
                        'set trackDuration to duration of current track',
                        'set trackPosition to player position',
                        'set playerState to player state as text',
                        'return playerState & "\\u001f" & trackName & "\\u001f" & trackArtist & "\\u001f" & (trackDuration as integer) & "\\u001f" & (trackPosition as integer)',
                        "end tell",
                        "end if",
                        'return "not_running"',
                    ]
                else:
                    script = [
                        f'if application "{app_name}" is running then',
                        f'tell application "{app_name}"',
                        'set trackName to name of current track',
                        'set trackArtist to artist of current track',
                        'set trackDuration to duration of current track',
                        'set trackPosition to player position',
                        'set playerState to player state as text',
                        'return playerState & "\\u001f" & trackName & "\\u001f" & trackArtist & "\\u001f" & (trackDuration as integer) & "\\u001f" & (trackPosition as integer)',
                        "end tell",
                        "end if",
                        'return "not_running"',
                    ]
                result = self._run(script, timeout=4.0)
            except (RuntimeError, subprocess.TimeoutExpired):
                continue
            if result == "not_running" or not result:
                continue
            parts = (result + "\x1f\x1f\x1f").split("\x1f")
            state = parts[0].strip().lower()
            title = parts[1].strip()
            if state not in {"playing", "paused", "stopped", "play", "pause"} or not title:
                continue
            return {
                "available": True,
                "state": state,
                "title": title,
                "artist": parts[2].strip(),
                "duration": max(0, int(parts[3] or 0)),
                "position": max(0, int(parts[4] or 0)),
                "browser": label,
                "source": app_name,
            }
        return {"available": False, "state": "not_open"}

    def _native_music_command(self, action: str, app_name: str) -> bool:
        command = {
            "play_pause": "playpause",
            "next": "next track",
            "previous": "previous track",
        }[action]
        try:
            self._run([
                f'if application "{app_name}" is running then',
                f'tell application "{app_name}" to {command}',
                "return \"ok\"",
                "end if",
                'return "not_running"',
            ], timeout=4.0)
            return True
        except (RuntimeError, subprocess.TimeoutExpired):
            return False

    def _youtube_tab_script(self, javascript: str) -> str:
        """Run one fixed JavaScript operation in the first YouTube Music tab."""
        try:
            return self._run([
                'if application "Brave Browser" is not running then return "not_open"',
                'tell application "Brave Browser"',
                'repeat with browserWindow in windows',
                'repeat with browserTab in tabs of browserWindow',
                'if (URL of browserTab starts with "https://music.youtube.com") then',
                f'return execute browserTab javascript {self._apple_string(javascript)}',
                'end if',
                'end repeat',
                'end repeat',
                'end tell',
                'return "not_open"',
            ], timeout=8.0)
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                "Brave did not answer. Allow Automation and JavaScript from Apple Events.") from exc

    @staticmethod
    def _apple_string(value: str) -> str:
        return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'

    def calendar_events(self, days: int = 14) -> dict[str, Any]:
        if not self.available:
            return {"available": False, "events": []}
        # Calendar can take a moment on first use while macOS asks the user for
        # permission. Fields are separated with ASCII unit separators so event
        # titles containing ordinary punctuation remain intact.
        script = [
            'set startDate to current date',
            f'set endDate to startDate + ({max(1, min(days, 31))} * days)',
            'set output to ""',
            'tell application "Calendar"',
            'repeat with cal in calendars',
            'set matches to (every event of cal whose start date is greater than or equal to startDate and start date is less than endDate)',
            'repeat with ev in matches',
            'set d to start date of ev',
            'set stamp to (year of d as integer) & "-" & (month of d as integer) & "-" & (day of d as integer) & " " & (hours of d as integer) & ":" & (minutes of d as integer)',
            'set output to output & (summary of ev) & (ASCII character 31) & (name of cal) & (ASCII character 31) & stamp & linefeed',
            'end repeat',
            'end repeat',
            'end tell',
            'return output',
        ]
        try:
            rows = self._run(script, timeout=7.0).splitlines()
            events = []
            for row in rows:
                parts = row.split(chr(31))
                if len(parts) != 3:
                    continue
                try:
                    start = datetime.strptime(parts[2], "%Y-%m-%d %H:%M")
                except ValueError:
                    continue
                events.append({"title": parts[0], "calendar": parts[1], "start": start.isoformat()})
            events.sort(key=lambda event: event["start"])
            return {"available": True, "events": events[:20]}
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            return {"available": False, "events": [], "error": str(exc)}
