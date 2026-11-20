"""Persistent, house-local storage for the editable 3D home model."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class DioramaStore:
    def __init__(self, path: Path, default_path: Path | None = None):
        self.path = path
        self.default_path = default_path

    @staticmethod
    def _read(path: Path) -> dict[str, Any]:
        if not path.is_file():
            return {"type": "custom:diorama-card", "rooms": [], "decorations": [], "devices": []}
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Diorama configuration must be a JSON object")
        return payload

    @staticmethod
    def validate(payload: dict[str, Any]) -> None:
        rooms = payload.get("rooms", [])
        decorations = payload.get("decorations", [])
        devices = payload.get("devices", [])
        if not isinstance(rooms, list) or not isinstance(decorations, list) or not isinstance(devices, list):
            raise ValueError("rooms, decorations and devices must be lists")
        room_ids = {room.get("id") for room in rooms if isinstance(room, dict)}
        if None in room_ids or len(room_ids) != len(rooms):
            raise ValueError("Every room needs a unique id")
        for room in rooms:
            points = room.get("points")
            if not isinstance(points, list) or len(points) < 3:
                raise ValueError(f"Room {room.get('id', '(unknown)')} needs at least three points")
        for item in decorations:
            if not isinstance(item, dict) or not item.get("id") or not item.get("kind"):
                raise ValueError("Every decoration needs an id and kind")
            if item.get("room") not in room_ids:
                raise ValueError(f"Decoration {item.get('id')} references an unknown room")

    def load(self) -> dict[str, Any]:
        source = self.path if self.path.is_file() else self.default_path
        return self._read(source) if source else self._read(self.path)

    def save(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.validate(payload)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.path)
        return payload
