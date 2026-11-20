"""Cached, read-only iCalendar subscription for the home dashboard."""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from datetime import date, datetime, time as datetime_time, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
import recurring_ical_events
from icalendar import Calendar


class CalendarFeed:
    """Fetch an ICS feed at most once per refresh interval and detect changes."""

    def __init__(self, url: str, token: str, state_path: Path,
                 refresh_seconds: int = 900):
        self.url = url.strip()
        self.token = token.strip()
        self.state_path = state_path
        self.refresh_seconds = max(60, refresh_seconds)
        self.lock = threading.Lock()
        self._worker: threading.Thread | None = None
        self.state = self._load_state()

    @classmethod
    def from_env(cls, state_path: Path) -> "CalendarFeed":
        return cls(
            os.environ.get("CALENDAR_ICS_URL", ""),
            os.environ.get("CALENDAR_ICS_TOKEN", ""),
            state_path,
            int(os.environ.get("CALENDAR_REFRESH_SECONDS", "900")),
        )

    def _load_state(self) -> dict[str, Any]:
        try:
            loaded = json.loads(self.state_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                return loaded
        except (OSError, ValueError):
            pass
        return {"events": [], "fingerprints": {}, "notifications": [], "last_sync_epoch": 0}

    def _save_state(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.state_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        temporary.replace(self.state_path)

    @staticmethod
    def _as_datetime(value: date | datetime) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return datetime.combine(value, datetime_time.min, tzinfo=timezone.utc)

    @classmethod
    def _event(cls, component: Any) -> dict[str, Any]:
        start = cls._as_datetime(component.decoded("DTSTART"))
        end_value = component.decoded("DTEND") if component.get("DTEND") else start
        end = cls._as_datetime(end_value)
        uid = str(component.get("UID") or "")
        title = str(component.get("SUMMARY") or "Untitled event")
        location = str(component.get("LOCATION") or "")
        identity = f"{uid or title}|{start.isoformat()}"
        raw = json.dumps({
            "title": title,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "location": location,
            "sequence": str(component.get("SEQUENCE") or "0"),
            "last_modified": str(component.get("LAST-MODIFIED") or ""),
        }, sort_keys=True)
        return {
            "id": hashlib.sha256(identity.encode()).hexdigest()[:20],
            "uid": uid,
            "title": title,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "location": location,
            "calendar": "Subscribed calendar",
            "fingerprint": hashlib.sha256(raw.encode()).hexdigest(),
        }

    def _download(self) -> tuple[list[dict[str, Any]], dict[str, str]]:
        headers = {"Accept": "text/calendar"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        response = httpx.get(self.url, headers=headers, timeout=12.0, follow_redirects=True)
        response.raise_for_status()
        calendar = Calendar.from_ical(response.content)
        now = datetime.now(timezone.utc)
        components = recurring_ical_events.of(calendar).between(
            now - timedelta(days=31), now + timedelta(days=365))
        events = [self._event(component) for component in components]
        events.sort(key=lambda item: item["start"])
        fingerprints = {item["id"]: item.pop("fingerprint") for item in events}
        return events, fingerprints

    def _refresh(self) -> None:
        events, fingerprints = self._download()
        previous = self.state.get("fingerprints", {})
        notifications = self.state.get("notifications", [])
        if previous:
            by_id = {event["id"]: event for event in events}
            stamp = datetime.now(timezone.utc).isoformat()
            for event_id, fingerprint in fingerprints.items():
                if event_id not in previous:
                    kind = "new"
                elif previous[event_id] != fingerprint:
                    kind = "updated"
                else:
                    continue
                event = by_id[event_id]
                notifications.insert(0, {
                    "id": f"{event_id}-{time.time_ns()}", "kind": kind,
                    "title": event["title"], "start": event["start"],
                    "detected_at": stamp, "read": False,
                })
        self.state.update({
            "events": events,
            "fingerprints": fingerprints,
            "notifications": notifications[:100],
            "last_sync_epoch": time.time(),
            "last_sync": datetime.now(timezone.utc).isoformat(),
            "error": "",
        })
        self._save_state()

    def status(self) -> dict[str, Any]:
        if not self.url:
            return {"configured": False, "events": [], "notifications": [], "unread": 0}
        with self.lock:
            last_check = max(float(self.state.get("last_sync_epoch", 0)),
                             float(self.state.get("last_attempt_epoch", 0)))
            if time.time() - last_check >= self.refresh_seconds:
                self.state["last_attempt_epoch"] = time.time()
                try:
                    self._refresh()
                except Exception as exc:  # malformed third-party feeds must not stop the home API
                    self.state["error"] = str(exc)
                    self.state["last_attempt"] = datetime.now(timezone.utc).isoformat()
                    self._save_state()
            notifications = self.state.get("notifications", [])
            return {
                "configured": True,
                "events": self.state.get("events", []),
                "notifications": notifications,
                "unread": sum(not item.get("read") for item in notifications),
                "last_sync": self.state.get("last_sync"),
                "error": self.state.get("error", ""),
                "refresh_seconds": self.refresh_seconds,
            }

    def start(self) -> None:
        """Run refreshes in the background so updates do not depend on an open browser."""
        if not self.url or (self._worker and self._worker.is_alive()):
            return

        def refresh_loop() -> None:
            while True:
                self.status()
                time.sleep(self.refresh_seconds)

        self._worker = threading.Thread(
            target=refresh_loop, name="calendar-feed-sync", daemon=True)
        self._worker.start()

    def mark_read(self) -> dict[str, Any]:
        with self.lock:
            for notification in self.state.get("notifications", []):
                notification["read"] = True
            self._save_state()
        return self.status()
