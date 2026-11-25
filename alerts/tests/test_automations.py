import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from service.automations import AutomationStore


class FakeHome:
    def __init__(self):
        self.entities = {"desk_light": {"name": "Desk light"}}
        self.commands = []

    def groups(self):
        return [{"id": "group_studio", "name": "Studio lights"}]

    def rooms(self):
        return ["Studio"]

    def command(self, target, action):
        self.commands.append(("device", target, action))
        return {"ok": True}

    def command_group(self, target, action):
        self.commands.append(("group", target, action))
        return {"ok": True}

    def turn_on_room(self, target):
        self.commands.append(("room", target, "turn_on"))
        return {"ok": True}

    def turn_off_room(self, target):
        self.commands.append(("room", target, "turn_off"))
        return {"ok": True}


class AutomationTests(unittest.TestCase):
    def test_time_rule_runs_once_per_local_minute_and_persists(self):
        home = FakeHome()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "automations.json"
            store = AutomationStore(path, home, "America/Indiana/Indianapolis")
            rule = store.add({
                "name": "Night off", "time": "22:00", "days": ["mon"],
                "target_type": "group", "target_id": "group_studio", "action": "turn_off",
                "timezone": "America/Indiana/Indianapolis",
            })
            monday_at_ten = datetime(2026, 11, 24, 3, 0, tzinfo=timezone.utc)

            first = store.run_due(monday_at_ten)
            second = store.run_due(monday_at_ten)
            reloaded = AutomationStore(path, home, "America/Indiana/Indianapolis")

        self.assertEqual(first, [rule["id"]])
        self.assertEqual(second, [])
        self.assertEqual(home.commands, [("group", "group_studio", "turn_off")])
        self.assertEqual(reloaded.snapshot()["stats"]["totalRules"], 1)


if __name__ == "__main__":
    unittest.main()
