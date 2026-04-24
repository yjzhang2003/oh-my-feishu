"""Main CLI application using prompt_toolkit."""

from __future__ import annotations

from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from prompt_toolkit.shortcuts import (
    radiolist_dialog,
    button_dialog,
    input_dialog,
    message_dialog,
)

from cli.status import get_all_status, ComponentStatus
from cli import actions


console = Console()


def format_status_summary(target_dir: Path | None = None) -> str:
    """Format a status summary table for display."""
    statuses = get_all_status(target_dir)

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("status", width=1)
    table.add_column("name", width=15)
    table.add_column("message")

    for key in ["claude", "feishu", "github", "ecc"]:
        status = statuses[key]
        icon = "✓" if status.is_configured else "✗"
        style = "green" if status.is_configured else "red"
        table.add_row(
            f"[{style}]{icon}[/{style}]",
            status.name,
            status.message or ("Configured" if status.is_configured else "Not configured"),
        )

    return Panel(
        table,
        title="Feishu Agent Setup",
        border_style="blue",
    )


def run_claude_menu() -> None:
    """Handle Claude Code configuration menu."""
    status = get_all_status()["claude"]

    if status.is_configured:
        result = button_dialog(
            title="Claude Code",
            text=f"Status: {status.message}\n\nWhat would you like to do?",
            buttons=[
                ("Re-configure", "reconfigure"),
                ("Reset", "reset"),
                ("Cancel", "cancel"),
            ],
        ).run()

        if result == "reconfigure":
            api_key = input_dialog(
                title="Claude Code API Key",
                text="Enter your ANTHROPIC_API_KEY:",
                password=True,
            ).run()

            if api_key:
                actions.configure_claude_api_key(api_key)
                console.print("[green]✓ API key saved to ~/.claude/settings.json[/green]")

        elif result == "reset":
            confirm = button_dialog(
                title="Reset Claude Code",
                text="This will remove your API key from ~/.claude/settings.json\nContinue?",
                buttons=[("Yes, Reset", True), ("Cancel", False)],
            ).run()

            if confirm:
                actions.reset_claude_api_key()
                console.print("[green]✓ Claude API key removed[/green]")
    else:
        api_key = input_dialog(
            title="Claude Code API Key",
            text="Enter your ANTHROPIC_API_KEY:",
            password=True,
        ).run()

        if api_key:
            actions.configure_claude_api_key(api_key)
            console.print("[green]✓ API key saved to ~/.claude/settings.json[/green]")


def run_feishu_menu(target_dir: Path) -> None:
    """Handle Feishu configuration menu."""
    status = get_all_status(target_dir)["feishu"]

    if status.is_configured:
        result = button_dialog(
            title="Feishu",
            text=f"Status: {status.message}\n\nWhat would you like to do?",
            buttons=[
                ("Re-configure", "reconfigure"),
                ("Reset", "reset"),
                ("Cancel", "cancel"),
            ],
        ).run()

        if result == "reconfigure":
            _configure_feishu_credentials(target_dir)
        elif result == "reset":
            confirm = button_dialog(
                title="Reset Feishu",
                text="This will remove FEISHU_APP_ID and FEISHU_APP_SECRET from .env\nContinue?",
                buttons=[("Yes, Reset", True), ("Cancel", False)],
            ).run()

            if confirm:
                actions.reset_feishu_credentials(target_dir)
                console.print("[green]✓ Feishu credentials removed[/green]")
    else:
        _configure_feishu_credentials(target_dir)


def _configure_feishu_credentials(target_dir: Path) -> None:
    """Prompt for Feishu credentials."""
    console.print("\n[yellow]Tip: Run 'feishu-agent setup' to scan QR and auto-create a bot[/yellow]\n")

    app_id = input_dialog(
        title="Feishu App ID",
        text="Enter your FEISHU_APP_ID:",
    ).run()

    if not app_id:
        return

    app_secret = input_dialog(
        title="Feishu App Secret",
        text="Enter your FEISHU_APP_SECRET:",
        password=True,
    ).run()

    if app_secret:
        actions.configure_feishu_credentials(target_dir, app_id, app_secret)
        console.print("[green]✓ Feishu credentials saved to .env[/green]")


def run_github_menu() -> None:
    """Handle GitHub configuration menu."""
    status = get_all_status()["github"]

    if status.is_configured:
        result = button_dialog(
            title="GitHub",
            text=f"Status: {status.message}\n\nWhat would you like to do?",
            buttons=[
                ("Logout", "logout"),
                ("Cancel", "cancel"),
            ],
        ).run()

        if result == "logout":
            confirm = button_dialog(
                title="GitHub Logout",
                text="This will log you out of GitHub CLI.\nContinue?",
                buttons=[("Yes, Logout", True), ("Cancel", False)],
            ).run()

            if confirm:
                actions.run_github_auth_logout()
                console.print("[green]✓ Logged out of GitHub[/green]")
    else:
        result = button_dialog(
            title="GitHub Authentication",
            text="GitHub CLI is not authenticated.\n\nThis will open a browser for OAuth login.",
            buttons=[
                ("Login with gh", "login"),
                ("Cancel", "cancel"),
            ],
        ).run()

        if result == "login":
            console.print("\n[cyan]Opening browser for GitHub OAuth...[/cyan]")
            actions.run_github_auth_login()


def run_ecc_menu() -> None:
    """Handle ECC plugin configuration menu."""
    status = get_all_status()["ecc"]

    if status.is_configured:
        result = button_dialog(
            title="ECC Plugin",
            text=f"Status: {status.message}\n\nWhat would you like to do?",
            buttons=[
                ("Check Updates", "update"),
                ("Cancel", "cancel"),
            ],
        ).run()

        if result == "update":
            console.print("\n[cyan]Updating ECC plugin...[/cyan]")
            if actions.update_ecc_plugin():
                console.print("[green]✓ ECC plugin updated[/green]")
            else:
                console.print("[red]✗ Failed to update ECC plugin[/red]")
    else:
        result = button_dialog(
            title="ECC Plugin",
            text="ECC (Everything Claude Code) is not installed.\n\n"
                 "ECC provides enhanced skills, agents, and hooks for Claude Code.",
            buttons=[
                ("Install ECC", "install"),
                ("Cancel", "cancel"),
            ],
        ).run()

        if result == "install":
            console.print("\n[cyan]Installing ECC plugin...[/cyan]")
            if actions.install_ecc_plugin():
                console.print("[green]✓ ECC plugin installed[/green]")
            else:
                console.print("[red]✗ Failed to install ECC plugin[/red]")


def run_tui(target_dir: Path | None = None) -> None:
    """Run the interactive TUI main loop."""
    target_dir = target_dir or Path.cwd()

    while True:
        # Show current status
        console.print(format_status_summary(target_dir))
        console.print()

        # Main menu
        result = radiolist_dialog(
            title="Select Component",
            text="Choose a component to configure:",
            values=[
                ("claude", "Claude Code"),
                ("feishu", "Feishu"),
                ("github", "GitHub"),
                ("ecc", "ECC Plugin"),
                ("exit", "Exit"),
            ],
        ).run()

        if result is None or result == "exit":
            console.print("\n[cyan]Goodbye![/cyan]")
            break

        if result == "claude":
            run_claude_menu()
        elif result == "feishu":
            run_feishu_menu(target_dir)
        elif result == "github":
            run_github_menu()
        elif result == "ecc":
            run_ecc_menu()

        console.print()  # Blank line before next iteration


if __name__ == "__main__":
    run_tui()
