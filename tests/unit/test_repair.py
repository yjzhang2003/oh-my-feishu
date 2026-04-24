import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from repair.flow import RepairFlow
from repair.github_client import GitHubClient
from repair.safety import DiffGuard, PathGuard


class TestPathGuard:
    def test_safe_path(self):
        guard = PathGuard(repo_root="/tmp/repo")
        assert guard.is_safe("/tmp/repo/src/main.py")

    def test_unsafe_path(self):
        guard = PathGuard(repo_root="/tmp/repo")
        assert not guard.is_safe("/etc/passwd")

    def test_assert_safe_raises(self):
        guard = PathGuard(repo_root="/tmp/repo")
        with pytest.raises(PermissionError):
            guard.assert_safe("/etc/passwd")


class TestDiffGuard:
    def test_small_diff_approved(self):
        guard = DiffGuard(max_files=10, max_lines=500)
        diff = "--- a/src/main.py\n+++ b/src/main.py\n@@ -1 +1 @@\n-old\n+new\n"
        result = guard.check_diff(diff)
        assert result["approved"]

    def test_large_diff_rejected(self):
        guard = DiffGuard(max_files=1, max_lines=5)
        diff = "\n".join([f"--- a/f{i}.py\n+++ b/f{i}.py\n@@ -1 +1 @@\n-old\n+new" for i in range(3)])
        result = guard.check_diff(diff)
        assert not result["approved"]


class TestGitHubClient:
    @patch("repair.github_client.httpx.post")
    def test_create_pr_success(self, mock_post):
        mock_post.return_value = MagicMock(status_code=201, json=lambda: {"html_url": "http://pr/1", "number": 1})
        client = GitHubClient(token="tk", owner="o", repo="r")
        result = client.create_pr(title="Fix bug", head="fix-branch")
        assert result["success"]
        assert result["pr_url"] == "http://pr/1"

    @patch("repair.github_client.httpx.get")
    def test_get_default_branch(self, mock_get):
        mock_get.return_value = MagicMock(json=lambda: {"default_branch": "develop"})
        client = GitHubClient(token="tk", owner="o", repo="r")
        assert client.get_default_branch() == "develop"


class TestRepairFlow:
    @patch("repair.flow.AgentCore")
    def test_run_success_skeleton(self, mock_agent_cls):
        mock_agent = MagicMock()
        mock_agent.run_task.side_effect = ["Root cause: div by zero", "diff content"]
        mock_agent_cls.return_value = mock_agent

        flow = RepairFlow(agent=mock_agent)
        result = flow.run(context="ZeroDivisionError", error_log="Traceback...")

        assert result["status"] == "success"
        assert "pr_url" in result

    @patch("repair.flow.AgentCore")
    def test_run_safety_rejection(self, mock_agent_cls):
        mock_agent = MagicMock()
        mock_agent.run_task.side_effect = ["Root cause", "diff content"]
        mock_agent_cls.return_value = mock_agent

        flow = RepairFlow(agent=mock_agent, diff_guard=DiffGuard(max_files=0, max_lines=0))
        result = flow.run(context="Error", error_log="log")

        assert result["status"] == "failed"
        assert "exceeds limits" in result["reason"]
