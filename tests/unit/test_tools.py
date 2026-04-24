import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from agent.tools.git_commit import git_commit, git_push
from agent.tools.read_code import read_code
from agent.tools.read_log import read_log
from agent.tools.run_test import run_test
from agent.tools.send_feishu_card import send_feishu_card


class TestReadLog:
    def test_read_existing_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as f:
            f.write("line1\nline2\nline3\n")
            path = f.name
        result = read_log(path)
        assert "line1" in result
        Path(path).unlink()

    def test_read_tail(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".log", delete=False) as f:
            f.write("line1\nline2\nline3\n")
            path = f.name
        result = read_log(path, lines=1)
        assert result.strip() == "line3"
        Path(path).unlink()

    def test_read_missing_file(self):
        result = read_log("/nonexistent/file.log")
        assert "not found" in result


class TestReadCode:
    def test_read_existing_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("def foo():\n    pass\n")
            path = f.name
        result = read_code(path)
        assert "def foo():" in result
        Path(path).unlink()

    def test_read_range(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("line1\nline2\nline3\n")
            path = f.name
        result = read_code(path, start_line=2, end_line=2)
        assert "line2" in result
        assert "line1" not in result
        Path(path).unlink()

    def test_read_missing_file(self):
        result = read_code("/nonexistent/file.py")
        assert "not found" in result


class TestRunTest:
    @patch("agent.tools.run_test.subprocess.run")
    def test_run_test_pass(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="OK", stderr="")
        result = run_test(".")
        assert result["passed"]

    @patch("agent.tools.run_test.subprocess.run")
    def test_run_test_fail(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="FAIL", stderr="")
        result = run_test(".")
        assert not result["passed"]

    @patch("agent.tools.run_test.subprocess.run", side_effect=Exception("boom"))
    def test_run_test_error(self, mock_run):
        result = run_test(".")
        assert not result["passed"]
        assert "boom" in result["error"]


class TestGitCommit:
    @patch("agent.tools.git_commit.subprocess.run")
    def test_git_commit_success(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="committed", stderr="")
        with tempfile.TemporaryDirectory() as tmpdir:
            result = git_commit(tmpdir, "test commit")
            assert result["success"]

    @patch("agent.tools.git_commit.subprocess.run")
    def test_git_commit_with_branch(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="committed", stderr="")
        with tempfile.TemporaryDirectory() as tmpdir:
            result = git_commit(tmpdir, "test", branch="feat/test")
            assert result["success"]
            assert result["branch"] == "feat/test"


class TestGitPush:
    @patch("agent.tools.git_commit.subprocess.run")
    def test_git_push_success(self, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stdout="pushed", stderr="")
        with tempfile.TemporaryDirectory() as tmpdir:
            result = git_push(tmpdir, "main")
            assert result["success"]


class TestSendFeishuCard:
    @patch("agent.tools.send_feishu_card.httpx.post")
    def test_missing_credentials(self, mock_post):
        with patch.dict("os.environ", {}, clear=True):
            result = send_feishu_card("u1", {"config": {}})
            assert "Missing" in result["error"]

    @patch("agent.tools.send_feishu_card.httpx.post")
    def test_send_success(self, mock_post):
        mock_post.return_value = MagicMock(json=lambda: {"tenant_access_token": "tok"})
        with patch.dict("os.environ", {"FEISHU_APP_ID": "a", "FEISHU_APP_SECRET": "s"}):
            result = send_feishu_card("u1", {"config": {}})
            assert "error" not in result or result.get("code") == 0
