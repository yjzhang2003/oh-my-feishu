import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class PathGuard:
    """Prevent file operations outside the designated repository root."""

    def __init__(self, repo_root: Optional[str] = None) -> None:
        self.repo_root = Path(repo_root or os.environ.get("REPO_ROOT", ".")).resolve()

    def is_safe(self, target: str) -> bool:
        try:
            resolved = Path(target).resolve()
            # Check that resolved path is inside repo_root
            return str(resolved).startswith(str(self.repo_root))
        except Exception as exc:
            logger.error("PathGuard check failed for %s: %s", target, exc)
            return False

    def assert_safe(self, target: str) -> None:
        if not self.is_safe(target):
            raise PermissionError(f"PathGuard blocked access to: {target} (outside {self.repo_root})")


class DiffGuard:
    """Enforce limits on the size of proposed code changes."""

    def __init__(
        self,
        max_files: Optional[int] = None,
        max_lines: Optional[int] = None,
    ) -> None:
        self.max_files = max_files if max_files is not None else int(os.environ.get("AGENT_MAX_DIFF_FILES", "10"))
        self.max_lines = max_lines if max_lines is not None else int(os.environ.get("AGENT_MAX_DIFF_LINES", "500"))

    def check_diff(self, diff_text: str) -> Dict[str, Any]:
        lines = diff_text.splitlines()
        # Very naive file counting: count "+++" or "---" lines that indicate files
        files = set()
        for line in lines:
            if line.startswith("+++ b/") or line.startswith("--- a/"):
                files.add(line.split(None, 1)[1].lstrip("ab/"))

        file_count = len(files)
        line_count = len(lines)

        approved = file_count <= self.max_files and line_count <= self.max_lines
        return {
            "approved": approved,
            "file_count": file_count,
            "line_count": line_count,
            "max_files": self.max_files,
            "max_lines": self.max_lines,
            "reason": None
            if approved
            else f"Diff exceeds limits: {file_count} files (max {self.max_files}), {line_count} lines (max {self.max_lines})",
        }
