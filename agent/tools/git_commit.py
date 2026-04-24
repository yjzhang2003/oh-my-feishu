import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


def git_commit(
    repo_path: str,
    message: str,
    branch: Optional[str] = None,
    files: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Stage files, commit, and optionally create a new branch.

    Args:
        repo_path: Absolute path to the git repository.
        message: Commit message.
        branch: If provided, create and checkout this branch before committing.
        files: Specific files to stage (default: all changes).

    Returns:
        Dict with success flag, branch, and output.
    """
    repo = Path(repo_path).resolve()
    try:
        if branch:
            subprocess.run(
                ["git", "checkout", "-b", branch],
                cwd=str(repo),
                capture_output=True,
                text=True,
                check=True,
            )

        if files:
            subprocess.run(["git", "add"] + files, cwd=str(repo), capture_output=True, text=True, check=True)
        else:
            subprocess.run(["git", "add", "-A"], cwd=str(repo), capture_output=True, text=True, check=True)

        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=str(repo),
            capture_output=True,
            text=True,
            check=False,
        )

        return {
            "success": result.returncode == 0,
            "branch": branch or "current",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except Exception as exc:
        logger.error("git_commit failed: %s", exc)
        return {"success": False, "error": str(exc)}


def git_push(repo_path: str, branch: str, remote: str = "origin") -> Dict[str, Any]:
    """Push branch to remote."""
    repo = Path(repo_path).resolve()
    try:
        result = subprocess.run(
            ["git", "push", "-u", remote, branch],
            cwd=str(repo),
            capture_output=True,
            text=True,
            check=False,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except Exception as exc:
        logger.error("git_push failed: %s", exc)
        return {"success": False, "error": str(exc)}
