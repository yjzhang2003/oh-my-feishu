"""Status detection utilities for components."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


class ComponentStatus:
    """Status information for a component."""

    def __init__(self, name: str, is_configured: bool, message: str = ""):
        self.name = name
        self.is_configured = is_configured
        self.message = message

    def __bool__(self) -> bool:
        return self.is_configured


def check_claude_code() -> ComponentStatus:
    """Check if Claude Code CLI is configured."""
    # Check if claude CLI exists
    result = run(["claude", "--version"])
    if result.returncode != 0:
        return ComponentStatus("Claude Code", False, "CLI not installed")

    # Check for API key in settings
    settings_path = Path.home() / ".claude" / "settings.json"
    if settings_path.exists():
        try:
            data = json.loads(settings_path.read_text())
            env = data.get("env", {})
            has_key = any(
                key in env
                for key in ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]
            )
            if has_key:
                version = result.stdout.strip().split("\n")[0]
                return ComponentStatus("Claude Code", True, f"{version} - API configured")
        except (json.JSONDecodeError, KeyError):
            pass

    return ComponentStatus("Claude Code", False, "API key not configured")


def check_feishu(target_dir: Path | None = None) -> ComponentStatus:
    """Check if Feishu is configured."""
    if target_dir is None:
        target_dir = Path.cwd()

    env_path = target_dir / ".env"
    if not env_path.exists():
        return ComponentStatus("Feishu", False, "No .env file")

    content = env_path.read_text()
    has_app_id = "FEISHU_APP_ID=" in content and "FEISHU_APP_ID=\n" not in content
    has_secret = "FEISHU_APP_SECRET=" in content and "FEISHU_APP_SECRET=\n" not in content

    if has_app_id and has_secret:
        # Extract app_id for display
        for line in content.split("\n"):
            if line.startswith("FEISHU_APP_ID="):
                app_id = line.split("=", 1)[1].strip()
                return ComponentStatus("Feishu", True, f"Bot: {app_id[:8]}...")

    return ComponentStatus("Feishu", False, "Bot credentials not configured")


def check_github() -> ComponentStatus:
    """Check if GitHub CLI is authenticated."""
    result = run(["gh", "auth", "status"])
    if result.returncode != 0:
        return ComponentStatus("GitHub", False, "gh CLI not authenticated")

    # Extract username from status output
    for line in result.stdout.split("\n"):
        if "Logged in to github.com as" in line:
            username = line.split(" as ")[1].split(" ")[0]
            return ComponentStatus("GitHub", True, f"Authenticated as {username}")

    return ComponentStatus("GitHub", False, "Not authenticated")


def check_ecc() -> ComponentStatus:
    """Check if ECC plugin is installed."""
    plugins_path = Path.home() / ".claude" / "plugins" / "installed_plugins.json"

    if not plugins_path.exists():
        return ComponentStatus("ECC", False, "Plugin not installed")

    try:
        data = json.loads(plugins_path.read_text())
        plugins = data.get("plugins", {})

        # Check for ECC plugin
        ecc_id = "everything-claude-code@everything-claude-code"
        if ecc_id in plugins:
            version = plugins[ecc_id][0].get("version", "unknown")
            return ComponentStatus("ECC", True, f"Plugin v{version} installed")

    except (json.JSONDecodeError, KeyError, IndexError):
        pass

    return ComponentStatus("ECC", False, "Plugin not installed")


def get_all_status(target_dir: Path | None = None) -> dict[str, ComponentStatus]:
    """Get status of all components."""
    return {
        "claude": check_claude_code(),
        "feishu": check_feishu(target_dir),
        "github": check_github(),
        "ecc": check_ecc(),
    }
