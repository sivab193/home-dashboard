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
                return {"available": False, "state": "not_open", "browser": "Brave Browser"}
            parts = (result + "\x1f\x1f").split("\x1f")
            return {"available": True, "state": parts[0], "title": parts[1],
                    "artist": parts[2], "browser": "Brave Browser"}
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            return {"available": False, "state": "setup_required",
                    "browser": "Brave Browser", "error": str(exc)}

    def music_command(self, action: str) -> dict[str, Any]:
        if not self.available:
            raise RuntimeError("YouTube Music controls are available only on macOS")
        javascript = self.YOUTUBE_MUSIC_ACTIONS.get(action)
        if not javascript:
            raise ValueError("unsupported YouTube Music action")
        result = self._youtube_tab_script(javascript)
        if result == "not_open":
            raise RuntimeError("Open music.youtube.com in Brave Browser first")
        if result in {"no_player", "no_button"}:
            raise RuntimeError("YouTube Music player controls were not found")
        return self.music_status()

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
