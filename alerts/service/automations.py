"""Persistent, timezone-aware smart-home automations."""
import json
import logging
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


log = logging.getLogger(__name__)
DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class AutomationStore:
    def __init__(self, path: Path, home, default_timezone: str):
        self.path = path
        self.home = home
        self.default_timezone = self._valid_timezone(default_timezone)
        self._lock = threading.Lock()
        self._rules = self._read()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @staticmethod
    def _valid_timezone(value: str) -> str:
        try:
            ZoneInfo(value)
            return value
        except (ZoneInfoNotFoundError, ValueError):
            return "America/Indiana/Indianapolis"

    def _read(self) -> dict[str, dict[str, Any]]:
        if not self.path.is_file():
            return {}
        try:
            data = json.loads(self.path.read_text())
            rules = data.get("rules", {}) if isinstance(data, dict) else {}
            return rules if isinstance(rules, dict) else {}
        except (OSError, json.JSONDecodeError):
            log.warning("Ignoring invalid automation file")
            return {}

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(".tmp")
        temp.write_text(json.dumps({"rules": self._rules}, indent=2) + "\n")
        temp.replace(self.path)

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._loop, daemon=True,
                                        name="home-automation-scheduler")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self) -> None:
        while not self._stop.wait(15):
            try:
                self.run_due()
            except Exception:
                log.exception("Automation scheduler check failed")

    def _target_name(self, rule: dict[str, Any]) -> str:
        target_type = rule["target_type"]
        target_id = rule["target_id"]
        if target_type == "device":
            return self.home.entities.get(target_id, {}).get("name", target_id)
        if target_type == "group":
            group = next((item for item in self.home.groups() if item["id"] == target_id), None)
            return group["name"] if group else target_id
        return target_id

    def _public_rule(self, rule: dict[str, Any]) -> dict[str, Any]:
        target_name = self._target_name(rule)
        day_label = "Every day" if len(rule["days"]) == 7 else ", ".join(
            day.title() for day in rule["days"])
        action_label = "Turn on" if rule["action"] == "turn_on" else "Turn off"
        return {**rule, "status": "active" if rule["enabled"] else "paused",
                "condition": f'{rule["time"]} · {day_label}',
                "target_name": target_name,
                "action_label": f"{action_label} {target_name}"}

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            rules = [self._public_rule(rule.copy()) for rule in self._rules.values()]
        rules.sort(key=lambda rule: (rule["time"], rule["name"]))
        return {"rules": rules,
                "stats": {"activeCount": sum(rule["enabled"] for rule in rules),
                          "totalRules": len(rules)}}

    def _validate(self, payload: dict[str, Any], rule_id: str | None = None) -> dict[str, Any]:
        name = str(payload.get("name") or "").strip()[:80]
        trigger_time = str(payload.get("time") or "").strip()
        timezone_name = self._valid_timezone(str(payload.get("timezone") or self.default_timezone))
        days = payload.get("days")
        target_type = str(payload.get("target_type") or "").strip()
        target_id = str(payload.get("target_id") or "").strip()
        action = str(payload.get("action") or "").strip()
        if not name:
            raise ValueError("automation name is required")
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", trigger_time):
            raise ValueError("choose a valid trigger time")
        if not isinstance(days, list) or not days:
            raise ValueError("choose at least one day")
        days = [day for day in DAY_KEYS if day in {str(value).lower() for value in days}]
        if not days:
            raise ValueError("choose at least one valid day")
        if target_type not in {"device", "group", "room"}:
            raise ValueError("choose a device, group, or room target")
        if target_type == "device" and target_id not in self.home.entities:
            raise ValueError("selected device is unavailable")
        if target_type == "group" and target_id not in {group["id"] for group in self.home.groups()}:
            raise ValueError("selected group is unavailable")
        if target_type == "room" and target_id not in self.home.rooms():
            raise ValueError("selected room is unavailable")
        if action not in {"turn_on", "turn_off"}:
            raise ValueError("choose turn on or turn off")
        return {"id": rule_id or f"automation_{uuid.uuid4().hex[:10]}", "name": name,
                "enabled": bool(payload.get("enabled", True)), "time": trigger_time,
                "days": days, "timezone": timezone_name, "target_type": target_type,
                "target_id": target_id, "action": action,
                "last_run_key": str(payload.get("last_run_key") or ""),
                "last_run_at": payload.get("last_run_at")}

    def add(self, payload: dict[str, Any]) -> dict[str, Any]:
        rule = self._validate(payload)
        with self._lock:
            self._rules[rule["id"]] = rule
            self._save()
        return self._public_rule(rule.copy())

    def toggle(self, rule_id: str) -> dict[str, Any]:
        with self._lock:
            rule = self._rules.get(rule_id)
            if not rule:
                raise KeyError(rule_id)
            rule["enabled"] = not rule.get("enabled", True)
            self._save()
            return self._public_rule(rule.copy())

    def remove(self, rule_id: str) -> None:
        with self._lock:
            if rule_id not in self._rules:
                raise KeyError(rule_id)
            self._rules.pop(rule_id)
            self._save()

    def execute(self, rule_id: str) -> dict[str, Any]:
        with self._lock:
            rule = self._rules.get(rule_id)
            if not rule:
                raise KeyError(rule_id)
            rule = rule.copy()
        if rule["target_type"] == "device":
            result = self.home.command(rule["target_id"], rule["action"])
        elif rule["target_type"] == "group":
            result = self.home.command_group(rule["target_id"], rule["action"])
        else:
            result = (self.home.turn_on_room(rule["target_id"])
                      if rule["action"] == "turn_on"
                      else self.home.turn_off_room(rule["target_id"]))
        with self._lock:
            if rule_id in self._rules:
                self._rules[rule_id]["last_run_at"] = datetime.now(timezone.utc).isoformat()
                self._save()
        return result

    def run_due(self, now: datetime | None = None) -> list[str]:
        now = now or datetime.now(timezone.utc)
        due = []
        with self._lock:
            rules = [rule.copy() for rule in self._rules.values()]
        for rule in rules:
            if not rule.get("enabled", True):
                continue
            local = now.astimezone(ZoneInfo(rule["timezone"]))
            run_key = f'{local.date().isoformat()}T{local.strftime("%H:%M")}'
            if (DAY_KEYS[local.weekday()] not in rule["days"] or
                    local.strftime("%H:%M") != rule["time"] or
                    rule.get("last_run_key") == run_key):
                continue
            try:
                self.execute(rule["id"])
                due.append(rule["id"])
            except Exception:
                log.exception("Automation %s failed", rule["id"])
            finally:
                with self._lock:
                    if rule["id"] in self._rules:
                        self._rules[rule["id"]]["last_run_key"] = run_key
                        self._save()
        return due
