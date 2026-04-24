import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def read_code(path: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> str:
    """Read source code file with optional line range.

    Args:
        path: Absolute path to the source file.
        start_line: 1-based start line (inclusive).
        end_line: 1-based end line (inclusive).

    Returns:
        The code content with line numbers or an error message.
    """
    try:
        target = Path(path).resolve()
        if not target.exists():
            return f"Error: file not found: {path}"
        if not target.is_file():
            return f"Error: not a file: {path}"

        lines = target.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
        start = (start_line or 1) - 1
        end = (end_line or len(lines))
        selected = lines[start:end]

        output = []
        for idx, line in enumerate(selected, start=start + 1):
            output.append(f"{idx:4d} | {line}")
        return "".join(output)
    except Exception as exc:
        logger.error("read_code failed for %s: %s", path, exc)
        return f"Error reading code: {exc}"
