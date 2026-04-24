#!/usr/bin/env python3
"""Feishu Agent setup CLI.

Deploys .claude/ skills, hooks, settings, and generates .env for a target project.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ASSETS_DIR = Path(__file__).parent.parent / "assets"
CLAUdecode_PLUGINS_JSON = Path.home() / ".claude" / "plugins" / "installed_plugins.json"


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def check_claude_cli() -> bool:
    result = run(["claude", "--version"])
    if result.returncode == 0:
        print(f"✅ Claude Code CLI found: {result.stdout.strip()}")
        return True
    print("❌ Claude Code CLI not found.")
    print("   Install: https://docs.anthropic.com/en/docs/claude-code/installation")
    print("   Or run:  npm install -g @anthropic-ai/claude-code")
    return False


def prompt(question: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    answer = input(f"{question}{suffix}: ").strip()
    return answer if answer else default


def prompt_bool(question: str, default: bool = True) -> bool:
    suffix = " [Y/n]" if default else " [y/N]"
    answer = input(f"{question}{suffix}: ").strip().lower()
    if not answer:
        return default
    return answer in ("y", "yes")


def deploy_assets(target: Path) -> None:
    claude_dir = target / ".claude"
    skills_dir = claude_dir / "skills"
    hooks_dir = target / "hooks"

    # Deploy skills
    src_skills = ASSETS_DIR / "claude" / "skills"
    if src_skills.exists():
        if skills_dir.exists():
            if not prompt_bool(f"Skills already exist at {skills_dir}. Overwrite?", default=False):
                print("   Skipping skills deployment.")
            else:
                shutil.copytree(src_skills, skills_dir, dirs_exist_ok=True)
                print(f"✅ Skills deployed to {skills_dir}")
        else:
            shutil.copytree(src_skills, skills_dir)
            print(f"✅ Skills deployed to {skills_dir}")

    # Deploy settings.json
    src_settings = ASSETS_DIR / "claude" / "settings.json.tmpl"
    dst_settings = claude_dir / "settings.json"
    if src_settings.exists():
        if dst_settings.exists() and not prompt_bool(
            f"settings.json already exists at {dst_settings}. Overwrite?", default=False
        ):
            print("   Skipping settings.json deployment.")
        else:
            claude_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_settings, dst_settings)
            print(f"✅ settings.json deployed to {dst_settings}")

    # Deploy hooks
    src_hooks = ASSETS_DIR / "hooks"
    if src_hooks.exists():
        if hooks_dir.exists():
            if not prompt_bool(f"Hooks already exist at {hooks_dir}. Overwrite?", default=False):
                print("   Skipping hooks deployment.")
            else:
                shutil.copytree(src_hooks, hooks_dir, dirs_exist_ok=True)
                print(f"✅ Hooks deployed to {hooks_dir}")
        else:
            shutil.copytree(src_hooks, hooks_dir)
            print(f"✅ Hooks deployed to {hooks_dir}")


def generate_env(target: Path) -> None:
    env_path = target / ".env"
    if env_path.exists() and not prompt_bool(f".env already exists at {env_path}. Regenerate?", default=False):
        print("   Skipping .env generation.")
        return

    print("\n📝 Configuring environment variables (press Enter to skip):")

    feishu_app_id = prompt("Feishu App ID")
    feishu_app_secret = prompt("Feishu App Secret")
    feishu_encrypt_key = prompt("Feishu Encrypt Key (optional)")
    feishu_verification_token = prompt("Feishu Verification Token (optional)")
    monitor_api_key = prompt("Monitor API Key (optional but recommended)")
    github_token = prompt("GitHub Token")
    github_owner = prompt("GitHub Repo Owner")
    github_repo = prompt("GitHub Repo Name")
    repo_root = prompt("REPO_ROOT (absolute path to target repo)", default=str(target.resolve()))

    lines = [
        "# Feishu (Lark)",
        f"FEISHU_APP_ID={feishu_app_id}",
        f"FEISHU_APP_SECRET={feishu_app_secret}",
    ]
    if feishu_encrypt_key:
        lines.append(f"FEISHU_ENCRYPT_KEY={feishu_encrypt_key}")
    if feishu_verification_token:
        lines.append(f"FEISHU_VERIFICATION_TOKEN={feishu_verification_token}")

    lines.extend([
        "",
        "# Monitor webhook protection",
        f"MONITOR_API_KEY={monitor_api_key}",
        "",
        "# GitHub",
        f"GITHUB_TOKEN={github_token}",
        f"GITHUB_REPO_OWNER={github_owner}",
        f"GITHUB_REPO_NAME={github_repo}",
        "",
        "# Agent",
        f"REPO_ROOT={repo_root}",
        "AGENT_LOG_LEVEL=INFO",
        "AGENT_MAX_DIFF_FILES=10",
        "AGENT_MAX_DIFF_LINES=500",
    ])

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✅ .env generated at {env_path}")


def check_ecc_plugin() -> bool:
    if not CLAUdecode_PLUGINS_JSON.exists():
        print("⚠️  Claude plugins registry not found. Skipping ECC check.")
        return False

    try:
        data = json.loads(CLAUdecode_PLUGINS_JSON.read_text(encoding="utf-8"))
        plugins = data.get("plugins", {})
        if "oh-my-claudecode@omc" in plugins:
            print("✅ ECC plugin (oh-my-claudecode) already installed.")
            return True
    except (json.JSONDecodeError, KeyError):
        pass

    print("⚠️  ECC plugin (oh-my-claudecode) not detected.")
    print("   Install it with:")
    print("       claude plugins add oh-my-claudecode@omc")
    print("   Or:")
    print("       npm install -g omc")
    return False


def run_tests(target: Path) -> bool:
    if not prompt_bool("Run unit tests now?", default=True):
        return False

    print("\n🧪 Running tests...")
    result = run([sys.executable, "-m", "pytest", "tests/unit/", "-q"], cwd=str(target))
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode == 0:
        print("✅ All tests passed.")
        return True
    print("❌ Some tests failed.")
    return False


def main() -> int:
    print("=" * 50)
    print("🚀 Feishu Agent Setup")
    print("=" * 50)

    # 1. Check Claude CLI
    if not check_claude_cli():
        if not prompt_bool("Continue without Claude CLI?", default=False):
            return 1

    # 2. Select target directory
    default_target = str(Path.cwd())
    target_input = prompt("Target directory", default=default_target)
    target = Path(target_input).expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    print(f"📁 Target: {target}\n")

    # 3. Deploy assets
    deploy_assets(target)

    # 4. Generate .env
    generate_env(target)

    # 5. Check ECC
    print("")
    check_ecc_plugin()

    # 6. Verify
    print("")
    if (target / "tests").exists():
        run_tests(target)

    print("\n" + "=" * 50)
    print("🎉 Setup complete!")
    print("=" * 50)
    print(f"\nNext steps:")
    print(f"  1. Review {target / '.env'}")
    print(f"  2. Start gateway:  fastapi dev gateway/webhook_server.py")
    print(f"  3. Or run a skill: claude --skill auto-repair")
    return 0


if __name__ == "__main__":
    sys.exit(main())
