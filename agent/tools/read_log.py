import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def read_log(path: str, lines: Optional[int] = None) -> str:
    """Read a log file or return the last N lines.

    Args:
        path: Absolute path to the log file.
        lines: If provided, return only the last N lines.

    Returns:
        The log content or an error message.
    """
    try:
        target = Path(path).resolve()
        if not target.exists():
            return f"Error: file not found: {path}"
        if not target.is_file():
            return f"Error: not a file: {path}"

        content = target.read_text(encoding="utf-8", errors="ignore")
        if lines:
            all_lines = content.splitlines(keepends=True)
            content = "".join(all_lines[-lines:])
        return content
    except Exception as exc:
        logger.error("read_log failed for %s: %s", path, exc)
        return f"Error reading log: {exc}"
