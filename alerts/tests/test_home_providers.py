import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from service.home import HomeAssistant


class FakeProvider:
    name = "local_test"
    enabled = True

    def __init__(self):
        self.last_command = None

    def entities(self):
        return [{
            "id": "test_switch",
            "entity_id": "local_test.device.switch",
            "name": "Test switch",
            "room": "Lab",
            "icon": "T",
            "type": "switch",
            "read_only": False,
            "provider": self.name,
        }]

    def states(self):
        return [{"id": "test_switch", "state": "on", "attributes": {"source": "test"}}]

    def command(self, item_id, action, data=None):
        self.last_command = (item_id, action, data)
        return {"ok": True}


class HomeProviderTests(unittest.TestCase):
    def test_local_provider_works_without_home_assistant_credentials(self):
        provider = FakeProvider()
        with tempfile.TemporaryDirectory() as directory:
            home = HomeAssistant({}, Path(directory) / "layout.json", providers=[provider])
            self.assertTrue(home.enabled)
            self.assertTrue(home.public_config()["configured"])
            self.assertEqual(home.states()[0]["state"], "on")
            home.command("test_switch", "turn_off")
        self.assertEqual(provider.last_command, ("test_switch", "turn_off", None))

    def test_home_assistant_entities_stay_visible_without_credentials(self):
        provider = FakeProvider()
        home = HomeAssistant({"entities": [{
            "id": "optional_light",
            "entity_id": "light.optional",
            "name": "Optional light",
        }]}, providers=[provider])

        self.assertEqual([item["id"] for item in home.public_config()["entities"]],
                         ["optional_light", "test_switch"])
        state = next(item for item in home.states() if item["id"] == "optional_light")
        self.assertEqual(state["state"], "unavailable")

    def test_local_device_group_can_be_renamed(self):
        provider = FakeProvider()
        with tempfile.TemporaryDirectory() as directory:
            home = HomeAssistant({}, Path(directory) / "layout.json", providers=[provider])
            home.update_entity("test_switch", {"device_name": "Example Room Power Strip"})
            entity = next(item for item in home.public_config()["entities"]
                          if item["id"] == "test_switch")
        self.assertEqual(entity["device_name"], "Example Room Power Strip")

    def test_room_power_can_be_turned_on_and_off(self):
        provider = FakeProvider()
        home = HomeAssistant({}, providers=[provider])

        self.assertTrue(home.turn_on_room("Lab")["ok"])
        self.assertEqual(provider.last_command, ("test_switch", "turn_on", None))
        self.assertTrue(home.turn_off_room("Lab")["ok"])
        self.assertEqual(provider.last_command, ("test_switch", "turn_off", None))

    def test_device_groups_persist_and_control_members(self):
        provider = FakeProvider()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "layout.json"
            home = HomeAssistant({}, path, providers=[provider])
            group = home.add_group({
                "name": "Lab power", "room": "Lab", "entity_ids": ["test_switch"]})

            result = home.command_group(group["id"], "turn_off")
            reloaded = HomeAssistant({}, path, providers=[provider])

        self.assertTrue(result["ok"])
        self.assertEqual(provider.last_command, ("test_switch", "turn_off", None))
        self.assertEqual(reloaded.groups()[0]["name"], "Lab power")

    @patch.dict("os.environ", {
        "HOME_ASSISTANT_URL": "http://homeassistant.invalid:8123",
        "HOME_ASSISTANT_TOKEN": "test-token",
    })
    @patch("service.home.httpx.Client")
    def test_home_assistant_states_use_one_request_and_keep_local_states(self, client_class):
        response = MagicMock()
        response.json.return_value = []
        client_class.return_value.__enter__.return_value.get.return_value = response
        provider = FakeProvider()
        home = HomeAssistant({"entities": [
            {"id": "light_one", "entity_id": "light.one"},
            {"id": "light_two", "entity_id": "light.two"},
        ]}, providers=[provider])

        states = home.states()

        client_class.return_value.__enter__.return_value.get.assert_called_once_with("/api/states")
        self.assertEqual(next(item for item in states if item["id"] == "test_switch")["state"], "on")


if __name__ == "__main__":
    unittest.main()
