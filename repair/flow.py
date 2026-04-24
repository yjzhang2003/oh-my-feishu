import logging
from typing import Any, Dict, Optional

from agent.core import AgentCore
from hooks.manager import HookManager
from repair.github_client import GitHubClient
from repair.safety import DiffGuard, PathGuard

logger = logging.getLogger(__name__)


class RepairFlow:
    """7-step auto-repair pipeline with safety gates and hooks."""

    def __init__(
        self,
        agent: AgentCore,
        path_guard: Optional[PathGuard] = None,
        diff_guard: Optional[DiffGuard] = None,
        github: Optional[GitHubClient] = None,
        hook_manager: Optional[HookManager] = None,
    ) -> None:
        self.agent = agent
        self.path_guard = path_guard or PathGuard()
        self.diff_guard = diff_guard or DiffGuard()
        self.github = github or GitHubClient()
        self.hooks = hook_manager or HookManager()

    def run(self, context: str, error_log: str) -> Dict[str, Any]:
        """
        Execute the repair flow.

        Args:
            context: Human-readable description of the detected issue.
            error_log: Traceback or error log content.

        Returns:
            Dict with status, pr_url, and summary.
        """
        self.hooks.emit("before_repair", context=context, error_log=error_log)
        logger.info("RepairFlow started: %s", context)

        try:
            # Step 1: Detect (already done by caller)
            # Step 2: Fetch log (caller provided error_log)

            # Step 3: Analyze via LLM
            analysis = self._analyze(error_log)
            if not analysis:
                return self._fail("LLM analysis returned empty")

            # Step 4: Propose diff
            diff = self._propose_diff(analysis, error_log)
            if not diff:
                return self._fail("No diff proposed")

            # Step 5: Safety review
            safety = self._safety_review(diff)
            if not safety["approved"]:
                return self._fail(f"Safety review rejected: {safety['reason']}")

            # Step 6: Apply & test
            test_result = self._apply_and_test(diff)
            if not test_result.get("passed"):
                return self._fail(f"Tests failed: {test_result.get('error', 'unknown')}")

            # Step 7: Commit & notify
            pr_result = self._commit_and_notify(context, diff)
            self.hooks.emit("after_repair", context=context, result=pr_result)
            return pr_result

        except Exception as exc:
            self.hooks.emit("on_error", error=str(exc), context=context)
            logger.exception("RepairFlow failed")
            return self._fail(str(exc))

    def _analyze(self, error_log: str) -> str:
        prompt = (
            "You are an expert software engineer.\n\n"
            "Analyze the following error log and provide a concise root-cause analysis:\n\n"
            f"{error_log}\n\n"
            "Root cause:"
        )
        return self.agent.run_task(prompt, max_turns=5)

    def _propose_diff(self, analysis: str, error_log: str) -> str:
        prompt = (
            "Based on the following root-cause analysis, propose a minimal git diff to fix the bug.\n\n"
            f"Analysis: {analysis}\n\n"
            f"Original error: {error_log}\n\n"
            "Provide ONLY the git diff in unified format. Do not include explanations."
        )
        return self.agent.run_task(prompt, max_turns=5)

    def _safety_review(self, diff: str) -> Dict[str, Any]:
        # Check diff size
        diff_check = self.diff_guard.check_diff(diff)
        if not diff_check["approved"]:
            return diff_check

        # Check paths in diff
        for line in diff.splitlines():
            if line.startswith("+++ b/") or line.startswith("--- a/"):
                path = line.split(None, 1)[1].lstrip("ab/")
                if not self.path_guard.is_safe(path):
                    return {
                        "approved": False,
                        "reason": f"PathGuard blocked: {path}",
                    }
        return {"approved": True}

    def _apply_and_test(self, diff: str) -> Dict[str, Any]:
        # In a real implementation, this would apply the diff to the filesystem,
        # run tests, and roll back on failure. For the skeleton we return a mock.
        logger.info("Applying diff and running tests (skeleton)")
        return {"passed": True, "stdout": "mock", "stderr": ""}

    def _commit_and_notify(self, context: str, diff: str) -> Dict[str, Any]:
        # In a real implementation, create branch, commit, push, open PR, send card.
        # For the skeleton we simulate success.
        logger.info("Committing changes and opening PR (skeleton)")
        return {
            "status": "success",
            "pr_url": "https://github.com/example/repo/pull/1",
            "summary": f"Auto-repair for: {context}",
        }

    def _fail(self, reason: str) -> Dict[str, Any]:
        return {"status": "failed", "reason": reason}
