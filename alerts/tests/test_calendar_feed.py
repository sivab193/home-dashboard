import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock
from unittest.mock import patch

from service.calendar_feed import CalendarFeed


class CalendarFeedTests(unittest.TestCase):
    def test_unconfigured_feed_is_safe(self):
        with tempfile.TemporaryDirectory() as folder:
            status = CalendarFeed("", "", Path(folder) / "state.json").status()
        self.assertFalse(status["configured"])
        self.assertEqual(status["events"], [])

    def test_second_sync_reports_new_and_updated_events(self):
        with tempfile.TemporaryDirectory() as folder:
            feed = CalendarFeed("https://calendar.test/feed.ics", "secret",
                                Path(folder) / "state.json", refresh_seconds=60)
            first = [{"id": "one", "title": "Existing", "start": "2026-11-21T12:00:00+00:00"}]
            second = [
                {"id": "one", "title": "Changed", "start": "2026-11-21T12:00:00+00:00"},
                {"id": "two", "title": "New", "start": "2026-11-22T12:00:00+00:00"},
            ]
            feed._download = Mock(side_effect=[(first, {"one": "a"}),
                                               (second, {"one": "b", "two": "c"})])
            self.assertEqual(feed.status()["notifications"], [])
            feed.state["last_sync_epoch"] = 0
            feed.state["last_attempt_epoch"] = 0
            status = feed.status()
        self.assertEqual(status["unread"], 2)
        self.assertEqual({item["kind"] for item in status["notifications"]}, {"new", "updated"})

    @patch("service.calendar_feed.httpx.get")
    def test_download_expands_recurring_events(self, get):
        start = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y%m%dT120000Z")
        response = Mock()
        response.content = ("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
                            f"UID:daily-test\r\nDTSTART:{start}\r\n"
                            "RRULE:FREQ=DAILY;COUNT=2\r\nSUMMARY:Daily event\r\n"
                            "END:VEVENT\r\nEND:VCALENDAR\r\n").encode()
        response.raise_for_status.return_value = None
        get.return_value = response
        with tempfile.TemporaryDirectory() as folder:
            events, _ = CalendarFeed("https://calendar.test/feed.ics", "",
                                     Path(folder) / "state.json")._download()
        self.assertEqual([event["title"] for event in events], ["Daily event", "Daily event"])

    def test_failed_refresh_is_throttled(self):
        with tempfile.TemporaryDirectory() as folder:
            feed = CalendarFeed("https://calendar.test/feed.ics", "",
                                Path(folder) / "state.json", refresh_seconds=900)
            feed._download = Mock(side_effect=RuntimeError("feed unavailable"))
            first = feed.status()
            second = feed.status()
        self.assertEqual(feed._download.call_count, 1)
        self.assertEqual(first["error"], "feed unavailable")
        self.assertEqual(second["error"], "feed unavailable")


if __name__ == "__main__":
    unittest.main()
