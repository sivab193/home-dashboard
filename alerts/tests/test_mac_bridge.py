import subprocess
import unittest
from unittest.mock import patch

from service.mac_bridge import MacBridge


class MacBridgeTests(unittest.TestCase):
    @patch("service.mac_bridge.platform.system", return_value="Darwin")
    @patch("service.mac_bridge.subprocess.run")
    def test_music_status_parses_track(self, run, _system):
        run.return_value = subprocess.CompletedProcess([], 0, "playing\x1fTrack\x1fArtist\n", "")
        self.assertEqual(MacBridge().music_status(), {
            "available": True, "state": "playing", "title": "Track",
            "artist": "Artist", "browser": "Brave Browser"})
        command = " ".join(run.call_args.args[0])
        self.assertIn("music.youtube.com", command)
        self.assertIn("Brave Browser", command)

    @patch("service.mac_bridge.platform.system", return_value="Darwin")
    @patch("service.mac_bridge.subprocess.run")
    def test_music_commands_are_allow_listed(self, run, _system):
        run.return_value = subprocess.CompletedProcess([], 0, "stopped\x1f\x1f\n", "")
        with self.assertRaisesRegex(ValueError, "unsupported"):
            MacBridge().music_command("delete_everything")
        run.assert_not_called()

    @patch("service.mac_bridge.platform.system", return_value="Darwin")
    @patch("service.mac_bridge.subprocess.run")
    def test_music_command_controls_youtube_tab(self, run, _system):
        run.side_effect = [
            subprocess.CompletedProcess([], 0, "ok\n", ""),
            subprocess.CompletedProcess([], 0, "paused\x1fTrack\x1fArtist\n", ""),
        ]
        result = MacBridge().music_command("next")
        self.assertEqual(result["state"], "paused")
        self.assertIn("#next-button", " ".join(run.call_args_list[0].args[0]))

    @patch("service.mac_bridge.platform.system", return_value="Darwin")
    @patch.object(MacBridge, "_native_music_status", return_value={"available": False, "state": "not_open"})
    @patch.object(MacBridge, "_youtube_tab_script", side_effect=RuntimeError("Apple Events disabled"))
    @patch("service.mac_bridge.subprocess.run")
    def test_music_status_falls_back_to_media_remote(self, run, _yt, _native, _system):
        run.return_value = subprocess.CompletedProcess(
            [],
            0,
            '{"available":true,"state":"playing","title":"Song","artist":"Band","duration":180,"position":12,"browser":"Mac Now Playing","source":"MediaRemote"}\n',
            "",
        )
        result = MacBridge().music_status()
        self.assertTrue(result["available"])
        self.assertEqual(result["state"], "playing")
        self.assertEqual(result["title"], "Song")
        self.assertEqual(result["duration"], 180)
        self.assertIn("mac-media.swift", " ".join(run.call_args.args[0]))

    @patch("service.mac_bridge.platform.system", return_value="Darwin")
    @patch("service.mac_bridge.time.sleep")
    @patch.object(MacBridge, "_native_music_status", return_value={"available": False, "state": "not_open"})
    @patch.object(MacBridge, "_youtube_tab_script", side_effect=RuntimeError("Apple Events disabled"))
    @patch("service.mac_bridge.subprocess.run")
    def test_music_command_falls_back_to_media_remote(self, run, _yt, _native, _sleep, _system):
        run.side_effect = [
            subprocess.CompletedProcess([], 0, '{"ok":true,"command":"toggle"}\n', ""),
            subprocess.CompletedProcess(
                [],
                0,
                '{"available":true,"state":"paused","title":"Song","artist":"Band","duration":180,"position":15,"browser":"Mac Now Playing","source":"MediaRemote"}\n',
                "",
            ),
        ]
        result = MacBridge().music_command("toggle")
        self.assertEqual(result["state"], "paused")
        self.assertEqual(run.call_args_list[0].args[0][-1], "toggle")


if __name__ == "__main__":
    unittest.main()
