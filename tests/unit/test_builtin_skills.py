from unittest.mock import MagicMock, patch

from skills._builtins.auto_repair.repair import AutoRepairSkill
from skills._builtins.service_monitor.monitor import ServiceMonitorSkill


class TestServiceMonitorSkill:
    def test_load_and_tools(self):
        skill = ServiceMonitorSkill(name="service_monitor")
        skill.load()
        tools = skill.get_tools()
        assert len(tools) == 2
        names = [t["function"]["name"] for t in tools]
        assert "check_health" in names
        assert "read_log_tail" in names

    @patch("skills._builtins.service_monitor.monitor.httpx")
    def test_check_health(self, mock_httpx):
        mock_httpx.get.return_value = MagicMock(status_code=200)
        skill = ServiceMonitorSkill(name="service_monitor")
        skill.load()
        result = skill.check_health("http://example.com")
        assert result["healthy"]

    def test_read_log_tail(self):
        import tempfile

        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as f:
            f.write("line1\nline2\n")
            path = f.name
        skill = ServiceMonitorSkill(name="service_monitor")
        result = skill.read_log_tail(path, lines=1)
        assert "line2" in result


class TestAutoRepairSkill:
    def test_load_and_tools(self):
        skill = AutoRepairSkill(name="auto_repair")
        skill.load()
        tools = skill.get_tools()
        assert len(tools) == 2
        names = [t["function"]["name"] for t in tools]
        assert "run_tests" in names
        assert "submit_pr" in names

    @patch("skills._builtins.auto_repair.repair.subprocess")
    def test_run_tests_pass(self, mock_subprocess):
        mock_subprocess.run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")
        skill = AutoRepairSkill(name="auto_repair")
        result = skill.run_tests(".")
        assert result["passed"]

    def test_submit_pr_placeholder(self):
        skill = AutoRepairSkill(name="auto_repair")
        result = skill.submit_pr("title")
        assert result["status"] == "not_implemented"
