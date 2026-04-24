import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from monitor.health_checker import HealthChecker
from monitor.issue_poller import IssuePoller
from monitor.log_watcher import LogWatcher


class TestLogWatcher:
    def test_tail(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as f:
            f.write("line1\nline2\nline3\n")
            path = f.name
        watcher = LogWatcher(path)
        result = watcher.tail(lines=2)
        assert "line2" in result
        assert "line3" in result
        Path(path).unlink()

    def test_poll_once(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as f:
            f.write("line1\n")
            path = f.name
        watcher = LogWatcher(path)
        # First poll should see nothing new (position at end)
        lines = watcher.poll_once()
        assert lines == []

        # Append more
        with open(path, "a") as f:
            f.write("line2\n")
        lines = watcher.poll_once()
        assert lines == ["line2\n"]
        Path(path).unlink()

    def test_poll_callback(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as f:
            f.write("line1\n")
            path = f.name
        watcher = LogWatcher(path)
        with open(path, "a") as f:
            f.write("line2\n")
        called = []
        watcher.poll_once(callback=lambda line: called.append(line))
        assert len(called) == 1
        Path(path).unlink()


class TestHealthChecker:
    @patch("monitor.health_checker.httpx.get")
    def test_healthy(self, mock_get):
        mock_get.return_value = MagicMock(status_code=200, elapsed=MagicMock(total_seconds=lambda: 0.1))
        checker = HealthChecker("http://example.com/health")
        result = checker.check()
        assert result["healthy"]
        assert result["status_code"] == 200

    @patch("monitor.health_checker.httpx.get", side_effect=httpx.RequestError("conn err"))
    def test_unhealthy(self, mock_get):
        checker = HealthChecker("http://example.com/health")
        result = checker.check()
        assert not result["healthy"]
        assert "conn err" in result["error"]


class TestIssuePoller:
    @patch("monitor.issue_poller.httpx.get")
    def test_fetch_recent(self, mock_get):
        mock_get.return_value = MagicMock(json=lambda: [{"number": 1, "title": "bug"}])
        poller = IssuePoller(owner="o", repo="r", token="t")
        issues = poller.fetch_recent()
        assert len(issues) == 1
        assert issues[0]["title"] == "bug"

    @patch("monitor.issue_poller.httpx.get", side_effect=Exception("network error"))
    def test_fetch_error(self, mock_get):
        poller = IssuePoller(owner="o", repo="r")
        issues = poller.fetch_recent()
        assert issues == []
