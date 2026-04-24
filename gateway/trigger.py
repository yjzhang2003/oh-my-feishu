import json
import logging
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

REPO_ROOT = Path(os.environ.get("REPO_ROOT", Path.cwd())).resolve()
TRIGGER_DIR = REPO_ROOT / ".claude" / "triggers"
TRIGGER_FILE = TRIGGER_DIR / "latest.json"

# Limits to prevent abuse
MAX_CONTEXT_LEN = 10_000
MAX_LOG_LEN = 100_000
SKILL_TIMEOUT_SECONDS = 300


def write_trigger(payload: Dict[str, Any]) -> None:
    """Persist trigger event so Claude Code skills can read it."""
    TRIGGER_DIR.mkdir(parents=True, exist_ok=True)
    TRIGGER_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Trigger written to %s", TRIGGER_FILE)


def invoke_skill(skill_name: str, extra_args: Optional[list[str]] = None) -> subprocess.CompletedProcess:
    """Invoke a Claude Code skill via subprocess.

    Requires `claude` CLI to be installed and authenticated.
    """
    cmd = ["claude", "--skill", skill_name]
    if extra_args:
        cmd.extend(extra_args)

    logger.info("Invoking skill: %s", " ".join(cmd))
    try:
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
            timeout=SKILL_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        logger.error("Skill %s timed out after %ss", skill_name, SKILL_TIMEOUT_SECONDS)
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=124,
            stdout=exc.stdout or "",
            stderr=f"Timeout after {SKILL_TIMEOUT_SECONDS}s",
        )
    except FileNotFoundError:
        logger.error("`claude` CLI not found. Is Claude Code installed?")
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=127,
            stdout="",
            stderr="claude CLI not found",
        )


def run_repair_pipeline(context: str, error_log: str, source: str = "manual") -> Dict[str, Any]:
    """High-level entry: write trigger + invoke auto-repair skill."""
    write_trigger(
        {
            "context": context[:MAX_CONTEXT_LEN],
            "error_log": error_log[:MAX_LOG_LEN],
            "source": source,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )

    result = invoke_skill("auto-repair")
    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }
