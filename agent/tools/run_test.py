import logging
import subprocess
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)


def run_test(target: str = ".", timeout: int = 120) -> Dict[str, Any]:
    """Run pytest on the given target.

    Args:
        target: Path or module to test (default: current directory).
        timeout: Max seconds to wait for tests.

    Returns:
        Dict with returncode, stdout, stderr, and passed flag.
    """
    try:
        cmd = ["pytest", target, "-v", "--tb=short", "--color=no"]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(Path(target).resolve().parent) if Path(target).is_file() else str(Path(target).resolve()),
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "passed": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"error": f"Tests timed out after {timeout}s", "passed": False}
    except Exception as exc:
        logger.error("run_test failed: %s", exc)
        return {"error": str(exc), "passed": False}
