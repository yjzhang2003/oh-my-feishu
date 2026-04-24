"""Configuration actions for each component."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


def run_cmd(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


# --- Claude Code Actions ---

def configure_claude_api_key(api_key: str) -> bool:
    """Save Claude API key to ~/.claude/settings.json."""
    settings_path = Path.home() / ".claude" / "settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    if settings_path.exists():
        try:
            data = json.loads(settings_path.read_text())
        except json.JSONDecodeError:
            data = {}
    else:
        data = {}

    if "env" not in data:
        data["env"] = {}

    data["env"]["ANTHROPIC_API_KEY"] = api_key
    settings_path.write_text(json.dumps(data, indent=2))
    return True


def reset_claude_api_key() -> bool:
    """Remove Claude API key from settings."""
    settings_path = Path.home() / ".claude" / "settings.json"
    if not settings_path.exists():
        return True

    try:
        data = json.loads(settings_path.read_text())
        if "env" in data:
            data["env"].pop("ANTHROPIC_API_KEY", None)
            data["env"].pop("ANTHROPIC_AUTH_TOKEN", None)
        settings_path.write_text(json.dumps(data, indent=2))
        return True
    except (json.JSONDecodeError, KeyError):
        return False


# --- Feishu Actions ---

def configure_feishu_credentials(target_dir: Path, app_id: str, app_secret: str) -> bool:
    """Save Feishu credentials to .env."""
    env_path = target_dir / ".env"

    if env_path.exists():
        lines = env_path.read_text().split("\n")
    else:
        lines = []

    found_app_id = False
    found_secret = False

    for i, line in enumerate(lines):
        if line.startswith("FEISHU_APP_ID="):
            lines[i] = f"FEISHU_APP_ID={app_id}"
            found_app_id = True
        elif line.startswith("FEISHU_APP_SECRET="):
            lines[i] = f"FEISHU_APP_SECRET={app_secret}"
            found_secret = True

    if not found_app_id:
        lines.append(f"FEISHU_APP_ID={app_id}")
    if not found_secret:
        lines.append(f"FEISHU_APP_SECRET={app_secret}")

    env_path.write_text("\n".join(lines) + "\n")
    return True


def reset_feishu_credentials(target_dir: Path) -> bool:
    """Remove Feishu credentials from .env."""
    env_path = target_dir / ".env"
    if not env_path.exists():
        return True

    lines = env_path.read_text().split("\n")
    filtered = [
        line for line in lines
        if not line.startswith("FEISHU_APP_ID=") and not line.startswith("FEISHU_APP_SECRET=")
    ]
    env_path.write_text("\n".join(filtered) + "\n")
    return True


# --- GitHub Actions ---

def run_github_auth_login() -> bool:
    """Run gh auth login interactively."""
    result = subprocess.run(
        ["gh", "auth", "login", "--git-protocol", "https", "--web"],
    )
    return result.returncode == 0


def run_github_auth_logout() -> bool:
    """Run gh auth logout."""
    result = run_cmd(["gh", "auth", "logout", "--hostname", "github.com"])
    return result.returncode == 0


# --- ECC Actions ---

def install_ecc_plugin() -> bool:
    """Install ECC plugin."""
    result = run_cmd([
        "claude", "plugins", "install",
        "everything-claude-code@everything-claude-code"
    ])
    return result.returncode == 0


def update_ecc_plugin() -> bool:
    """Update ECC plugin."""
    result = run_cmd([
        "claude", "plugins", "update",
        "everything-claude-code@everything-claude-code"
    ])
    return result.returncode == 0
