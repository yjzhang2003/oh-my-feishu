#!/usr/bin/env python3
"""Feishu Agent setup CLI.

Deploys .claude/ skills, hooks, settings, and generates .env for a target project.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ASSETS_DIR = Path(__file__).parent.parent / "assets"
CLAUdecode_PLUGINS_JSON = Path.home() / ".claude" / "plugins" / "installed_plugins.json"

# Feishu QR registration constants
_ACCOUNTS_URLS = {
    "feishu": "https://accounts.feishu.cn",
    "lark": "https://accounts.larksuite.com",
}
_OPEN_URLS = {
    "feishu": "https://open.feishu.cn",
    "lark": "https://open.larksuite.com",
}
_REGISTRATION_PATH = "/oauth/v1/app/registration"
_ONBOARD_TIMEOUT_S = 10


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


# ---------------------------------------------------------------------------
# Feishu QR Registration (based on Hermes Agent)
# ---------------------------------------------------------------------------


def _post_registration(base_url: str, body: dict) -> dict:
    """POST form-encoded data to the registration endpoint, return parsed JSON."""
    data = urlencode(body).encode("utf-8")
    req = Request(
        f"{base_url}{_REGISTRATION_PATH}",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urlopen(req, timeout=_ONBOARD_TIMEOUT_S) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _init_registration(domain: str = "feishu") -> None:
    """Verify the environment supports client_secret auth."""
    base_url = _ACCOUNTS_URLS.get(domain, _ACCOUNTS_URLS["feishu"])
    res = _post_registration(base_url, {"action": "init"})
    methods = res.get("supported_auth_methods") or []
    if "client_secret" not in methods:
        raise RuntimeError(
            f"Feishu / Lark registration environment does not support client_secret auth. "
            f"Supported: {methods}"
        )


def _begin_registration(domain: str = "feishu") -> dict:
    """Start the device-code flow. Returns device_code, qr_url, interval, expire_in."""
    base_url = _ACCOUNTS_URLS.get(domain, _ACCOUNTS_URLS["feishu"])
    res = _post_registration(base_url, {
        "action": "begin",
        "archetype": "PersonalAgent",
        "auth_method": "client_secret",
        "request_user_info": "open_id",
    })
    device_code = res.get("device_code")
    if not device_code:
        raise RuntimeError("Feishu / Lark registration did not return a device_code")
    qr_url = res.get("verification_uri_complete", "")
    if "?" in qr_url:
        qr_url += "&from=feishu-agent&tp=feishu-agent"
    else:
        qr_url += "?from=feishu-agent&tp=feishu-agent"
    return {
        "device_code": device_code,
        "qr_url": qr_url,
        "user_code": res.get("user_code", ""),
        "interval": res.get("interval") or 5,
        "expire_in": res.get("expire_in") or 600,
    }


def _poll_registration(
    *,
    device_code: str,
    interval: int,
    expire_in: int,
    domain: str = "feishu",
) -> dict | None:
    """Poll until the user scans the QR code, or timeout/denial."""
    deadline = time.time() + expire_in
    current_domain = domain
    poll_count = 0

    while time.time() < deadline:
        base_url = _ACCOUNTS_URLS.get(current_domain, _ACCOUNTS_URLS["feishu"])
        try:
            res = _post_registration(base_url, {
                "action": "poll",
                "device_code": device_code,
                "tp": "ob_app",
            })
        except (URLError, OSError, json.JSONDecodeError):
            time.sleep(interval)
            continue

        poll_count += 1
        if poll_count == 1:
            print("  Waiting for scan...", end="", flush=True)
        elif poll_count % 6 == 0:
            print(".", end="", flush=True)

        # Domain auto-detection
        user_info = res.get("user_info") or {}
        tenant_brand = user_info.get("tenant_brand")
        if tenant_brand == "lark" and current_domain != "lark":
            current_domain = "lark"

        # Success
        if res.get("client_id") and res.get("client_secret"):
            if poll_count > 0:
                print()  # newline after dots
            return {
                "app_id": res["client_id"],
                "app_secret": res["client_secret"],
                "domain": current_domain,
                "open_id": user_info.get("open_id"),
            }

        # Terminal errors
        error = res.get("error")
        if error == "access_denied":
            print("\n❌ Registration denied by user.")
            return None
        if error == "expired_token":
            print("\n❌ QR code expired. Please try again.")
            return None

        time.sleep(interval)

    print("\n❌ Registration timed out.")
    return None


def _render_qr_terminal(url: str) -> bool:
    """Try to render a QR code in the terminal. Returns True if successful."""
    try:
        import qrcode
        qr = qrcode.QRCode()
        qr.add_data(url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
        return True
    except ImportError:
        return False


def qr_register_feishu(*, domain: str = "feishu", timeout_seconds: int = 300) -> dict | None:
    """Run the Feishu / Lark scan-to-create QR registration flow.

    Returns on success:
        {
            "app_id": str,
            "app_secret": str,
            "domain": "feishu" | "lark",
            "open_id": str | None,
        }
    """
    print(f"\n📱 Feishu / Lark Bot Registration")
    print("-" * 40)

    try:
        print("  Connecting to Feishu / Lark...", end="", flush=True)
        _init_registration(domain)
        begin = _begin_registration(domain)
        print(" done.")

        print()
        qr_url = begin["qr_url"]
        if _render_qr_terminal(qr_url):
            print(f"\n  Scan the QR code above, or open this URL directly:\n  {qr_url}")
        else:
            print(f"  Open this URL in Feishu / Lark on your phone:\n\n  {qr_url}\n")
            print("  Tip: pip install qrcode  to display a scannable QR code here next time")
        print()

        result = _poll_registration(
            device_code=begin["device_code"],
            interval=begin["interval"],
            expire_in=min(begin["expire_in"], timeout_seconds),
            domain=domain,
        )

        if result:
            print(f"\n✅ Bot created successfully!")
            print(f"   App ID: {result['app_id']}")
            print(f"   Domain: {result['domain']}")
        return result

    except (RuntimeError, URLError, OSError, json.JSONDecodeError) as exc:
        print(f"\n❌ Registration failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# GitHub Authentication (via gh CLI)
# ---------------------------------------------------------------------------


def check_gh_cli() -> bool:
    """Check if GitHub CLI is installed."""
    result = run(["gh", "--version"])
    if result.returncode == 0:
        version = result.stdout.strip().split("\n")[0]
        print(f"✅ GitHub CLI found: {version}")
        return True
    print("❌ GitHub CLI not found.")
    print("   Install: https://cli.github.com/")
    print("   Or run:  brew install gh")
    return False


def check_gh_auth() -> bool:
    """Check if GitHub CLI is authenticated."""
    result = run(["gh", "auth", "status"])
    if result.returncode == 0:
        # Extract username from status output
        for line in result.stdout.split("\n"):
            if "Logged in to github.com as" in line:
                username = line.split(" as ")[1].split(" ")[0]
                print(f"✅ GitHub authenticated as: {username}")
                return True
    return False


def get_gh_token() -> str | None:
    """Get GitHub token from gh CLI."""
    result = run(["gh", "auth", "token"])
    if result.returncode == 0:
        return result.stdout.strip()
    return None


def get_git_remote_info(target: Path) -> dict | None:
    """Get owner/repo from git remote origin URL."""
    result = run(["git", "remote", "get-url", "origin"], cwd=str(target))
    if result.returncode != 0:
        return None

    url = result.stdout.strip()
    # Parse GitHub URL: https://github.com/owner/repo.git or git@github.com:owner/repo.git
    if "github.com" in url:
        parts = url.replace(".git", "").replace(":", "/").split("/")
        if len(parts) >= 2:
            return {
                "owner": parts[-2],
                "repo": parts[-1],
            }
    return None


def setup_github_auth(target: Path) -> dict | None:
    """Setup GitHub authentication and return credentials."""
    print("\n🔐 GitHub Authentication")
    print("-" * 40)

    # Check gh CLI
    if not check_gh_cli():
        if not prompt_bool("Continue without GitHub CLI?", default=False):
            return None
        return {"token": "", "owner": "", "repo": ""}

    # Check if already authenticated
    if check_gh_auth():
        token = get_gh_token()
        remote_info = get_git_remote_info(target)

        if token and remote_info:
            print(f"   Using repo: {remote_info['owner']}/{remote_info['repo']}")
            return {
                "token": token,
                "owner": remote_info["owner"],
                "repo": remote_info["repo"],
            }
        elif token:
            return {"token": token, "owner": "", "repo": ""}
    else:
        print("   GitHub CLI is not authenticated.")
        if prompt_bool("Run 'gh auth login' now? (Recommended)", default=True):
            print("\n   Starting GitHub OAuth flow...")
            print("   A browser window will open, or copy the URL from below.\n")
            # Run interactively - don't capture output so user sees the URL
            result = subprocess.run(
                ["gh", "auth", "login", "--git-protocol", "https", "--web"],
            )
            if result.returncode == 0:
                print("\n✅ GitHub authentication successful!")
                token = get_gh_token()
                remote_info = get_git_remote_info(target)
                return {
                    "token": token or "",
                    "owner": remote_info.get("owner", "") if remote_info else "",
                    "repo": remote_info.get("repo", "") if remote_info else "",
                }
            else:
                print("❌ GitHub authentication failed.")
                if result.stderr:
                    print(f"   Error: {result.stderr.strip()}")

    return {"token": "", "owner": "", "repo": ""}


def generate_env(target: Path, feishu_creds: dict | None = None, github_creds: dict | None = None) -> None:
    env_path = target / ".env"
    if env_path.exists() and not prompt_bool(f".env already exists at {env_path}. Regenerate?", default=False):
        print("   Skipping .env generation.")
        return

    print("\n📝 Configuring environment variables:")

    # If we got credentials from QR scan, use them
    if feishu_creds:
        feishu_app_id = feishu_creds.get("app_id", "")
        feishu_app_secret = feishu_creds.get("app_secret", "")
        print(f"   Using Feishu App ID from QR scan: {feishu_app_id}")
    else:
        feishu_app_id = prompt("Feishu App ID")
        feishu_app_secret = prompt("Feishu App Secret")

    feishu_encrypt_key = prompt("Feishu Encrypt Key (optional)")
    feishu_verification_token = prompt("Feishu Verification Token (optional)")
    monitor_api_key = prompt("Monitor API Key (optional but recommended)")

    # GitHub credentials
    if github_creds and github_creds.get("token"):
        github_token = github_creds["token"]
        github_owner = github_creds.get("owner", "")
        github_repo = github_creds.get("repo", "")
        if github_owner and github_repo:
            print(f"   Using GitHub repo: {github_owner}/{github_repo}")
        else:
            github_owner = prompt("GitHub Repo Owner", github_owner)
            github_repo = prompt("GitHub Repo Name", github_repo)
    else:
        github_token = prompt("GitHub Token (optional if using gh CLI)")
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


def check_and_install_plugins() -> bool:
    """Check and install required Claude Code plugins."""
    plugins_to_install = [
        ("everything-claude-code@everything-claude-code", "ECC (Everything Claude Code)"),
    ]

    installed = []

    for plugin_id, plugin_name in plugins_to_install:
        print(f"\n📦 Checking {plugin_name}...")

        # Check if already installed
        if CLAUdecode_PLUGINS_JSON.exists():
            try:
                data = json.loads(CLAUdecode_PLUGINS_JSON.read_text(encoding="utf-8"))
                plugins = data.get("plugins", {})
                if plugin_id in plugins:
                    print(f"✅ {plugin_name} already installed.")
                    installed.append(plugin_id)
                    continue
            except (json.JSONDecodeError, KeyError):
                pass

        # Try to install
        if prompt_bool(f"Install {plugin_name} ({plugin_id})?", default=True):
            print(f"   Installing {plugin_id}...")
            result = run(["claude", "plugins", "install", plugin_id])
            if result.returncode == 0:
                print(f"✅ {plugin_name} installed successfully.")
                installed.append(plugin_id)
            else:
                print(f"❌ Failed to install {plugin_name}.")
                if result.stderr:
                    print(f"   Error: {result.stderr.strip()}")
                print(f"   You can install manually with: claude plugins install {plugin_id}")
        else:
            print(f"   Skipping {plugin_name}. Install manually with:")
            print(f"       claude plugins install {plugin_id}")

    return len(installed) == len(plugins_to_install)


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


def run_setup(target: Path | None = None) -> int:
    """Run the setup wizard."""
    print("=" * 50)
    print("🚀 Feishu Agent Setup")
    print("=" * 50)

    # 1. Check Claude CLI
    if not check_claude_cli():
        if not prompt_bool("Continue without Claude CLI?", default=False):
            return 1

    # 2. Select target directory
    if target is None:
        default_target = str(Path.cwd())
        target_input = prompt("Target directory", default=default_target)
        target = Path(target_input).expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    print(f"📁 Target: {target}\n")

    # 3. Deploy assets
    deploy_assets(target)

    # 4. Feishu bot setup (QR or manual)
    print("")
    feishu_creds = None
    if prompt_bool("\n🤖 Set up Feishu bot now? (Recommended: scan QR to auto-create)", default=True):
        if prompt_bool("Use QR scan to create a new Feishu bot? (Recommended)", default=True):
            domain = "lark" if prompt_bool("Use Lark (international) instead of Feishu (China)?", default=False) else "feishu"
            feishu_creds = qr_register_feishu(domain=domain)
        else:
            print("\n📝 Enter your existing Feishu bot credentials manually.")

    # 5. GitHub authentication
    print("")
    github_creds = None
    if prompt_bool("\n🔐 Set up GitHub authentication now? (Recommended)", default=True):
        github_creds = setup_github_auth(target)

    # 6. Generate .env
    generate_env(target, feishu_creds=feishu_creds, github_creds=github_creds)

    # 7. Install plugins (ECC)
    print("")
    check_and_install_plugins()

    # 8. Verify
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


def run_cli() -> int:
    """Run the Feishu Agent CLI (placeholder for future expansion)."""
    print("🤖 Feishu Agent CLI")
    print("-" * 40)
    print("\n  Commands:")
    print("    setup    - Re-run setup wizard")
    print("    help     - Show this help")
    print("\n  TODO: Interactive CLI coming soon!")
    print("  For now, use Claude Code Skills directly:")
    print("    claude --skill auto-repair")
    print("    claude --skill analyze-log")
    return 0


def is_setup_complete(target: Path) -> bool:
    """Check if setup has been completed (env file exists)."""
    return (target / ".env").exists()


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="feishu-agent",
        description="Feishu Agent - Autonomous service repair with Claude Code",
    )
    parser.add_argument(
        "command",
        nargs="?",
        choices=["setup", "help"],
        help="Command to run: 'setup' to reconfigure, 'help' for usage",
    )
    parser.add_argument(
        "--target",
        type=Path,
        help="Target directory for setup",
    )

    args = parser.parse_args()

    # Handle explicit commands
    if args.command == "help":
        parser.print_help()
        return 0

    if args.command == "setup":
        return run_setup(target=args.target)

    # No command specified - check if setup needed
    target = args.target or Path.cwd()
    if not is_setup_complete(target):
        print("⚠️  Feishu Agent not configured. Starting setup...\n")
        return run_setup(target=target)

    # Already set up - enter CLI
    return run_cli()


if __name__ == "__main__":
    sys.exit(main())
