import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from gateway.trigger import invoke_skill, run_repair_pipeline, write_trigger


class TestWriteTrigger:
    def test_writes_json_trigger(self, tmp_path):
        with patch("gateway.trigger.TRIGGER_DIR", tmp_path / "triggers"):
            with patch("gateway.trigger.TRIGGER_FILE", tmp_path / "triggers" / "latest.json"):
                payload = {"source": "test", "message": "hello"}
                write_trigger(payload)
                written = json.loads((tmp_path / "triggers" / "latest.json").read_text(encoding="utf-8"))
                assert written["source"] == "test"
                assert written["message"] == "hello"


class TestInvokeSkill:
    @patch("gateway.trigger.subprocess.run")
    def test_invokes_claude_skill(self, mock_run):
        mock_run.return_value = MagicMock(stdout="ok", stderr="", returncode=0)
        result = invoke_skill("auto-repair")
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert args[:3] == ["claude", "--skill", "auto-repair"]
        assert result.stdout == "ok"
        assert result.returncode == 0

    @patch("gateway.trigger.subprocess.run")
    def test_invokes_with_extra_args(self, mock_run):
        mock_run.return_value = MagicMock(stdout="ok", stderr="", returncode=0)
        invoke_skill("auto-repair", ["--context", "bug"])
        args = mock_run.call_args[0][0]
        assert "--context" in args
        assert "bug" in args

    @patch("gateway.trigger.subprocess.run")
    def test_timeout_returns_error(self, mock_run):
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=["claude"], timeout=300)
        result = invoke_skill("auto-repair")
        assert result.returncode == 124
        assert "Timeout" in result.stderr

    @patch("gateway.trigger.subprocess.run")
    def test_missing_cli_returns_error(self, mock_run):
        mock_run.side_effect = FileNotFoundError("claude not found")
        result = invoke_skill("auto-repair")
        assert result.returncode == 127
        assert "not found" in result.stderr


class TestRunRepairPipeline:
    @patch("gateway.trigger.invoke_skill")
    @patch("gateway.trigger.write_trigger")
    def test_pipeline_flow(self, mock_write, mock_invoke):
        mock_invoke.return_value = MagicMock(stdout="fixed", stderr="", returncode=0)
        result = run_repair_pipeline(context="bug", error_log="trace", source="monitor")

        mock_write.assert_called_once()
        payload = mock_write.call_args[0][0]
        assert payload["context"] == "bug"
        assert payload["error_log"] == "trace"
        assert payload["source"] == "monitor"
        assert "timestamp" in payload

        mock_invoke.assert_called_once_with("auto-repair")
        assert result["stdout"] == "fixed"
        assert result["returncode"] == 0

    @patch("gateway.trigger.invoke_skill")
    @patch("gateway.trigger.write_trigger")
    def test_truncates_long_context(self, mock_write, mock_invoke):
        mock_invoke.return_value = MagicMock(stdout="", stderr="", returncode=0)
        long_context = "x" * 20_000
        long_log = "y" * 200_000
        run_repair_pipeline(context=long_context, error_log=long_log)

        payload = mock_write.call_args[0][0]
        assert len(payload["context"]) == 10_000
        assert len(payload["error_log"]) == 100_000
