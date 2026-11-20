import json
import tempfile
import unittest
from pathlib import Path

from service.diorama import DioramaStore


class DioramaStoreTests(unittest.TestCase):
    def test_loads_default_then_persists_house_override(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            default = root / "default.json"
            saved = root / "data" / "diorama.json"
            payload = {"rooms": [{"id": "living", "points": [[0, 0], [2, 0], [2, 2]]}],
                       "decorations": [], "devices": []}
            default.write_text(json.dumps(payload), encoding="utf-8")
            store = DioramaStore(saved, default)

            self.assertEqual(store.load(), payload)
            edited = {**payload, "background": {"dark": "graphite"}}
            self.assertEqual(store.save(edited), edited)
            self.assertEqual(store.load(), edited)

    def test_rejects_decoration_for_unknown_room(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DioramaStore(Path(directory) / "diorama.json")
            with self.assertRaisesRegex(ValueError, "unknown room"):
                store.save({"rooms": [], "devices": [], "decorations": [
                    {"id": "lamp", "kind": "light_floor", "room": "missing"}
                ]})


if __name__ == "__main__":
    unittest.main()
