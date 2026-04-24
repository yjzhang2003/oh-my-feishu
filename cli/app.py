"""Main TUI application for Feishu Agent."""

from pathlib import Path

from textual.app import App

from cli.screens.dashboard import DashboardScreen
from cli.screens.claude_setup import ClaudeSetupScreen
from cli.screens.feishu_setup import FeishuSetupScreen
from cli.screens.github_setup import GithubSetupScreen
from cli.screens.ecc_setup import EccSetupScreen


class FeishuAgentApp(App):
    """Feishu Agent TUI Application."""

    CSS = """
    App {
        background: $surface;
        color: $text;
    }

    Header {
        background: $primary;
        color: $text-on-primary;
    }

    Footer {
        background: $primary-darken-1;
        color: $text-on-primary;
    }
    """

    SCREENS = {
        "dashboard": DashboardScreen,
        "claude-setup": ClaudeSetupScreen,
        "feishu-setup": FeishuSetupScreen,
        "github-setup": GithubSetupScreen,
        "ecc-setup": EccSetupScreen,
    }

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("d", "dashboard", "Dashboard"),
    ]

    def __init__(self, target_dir: Path | None = None):
        super().__init__()
        self.target_dir = target_dir or Path.cwd()

    def on_mount(self) -> None:
        """Start with the dashboard."""
        self.push_screen("dashboard")

    def action_dashboard(self) -> None:
        """Go to dashboard."""
        self.push_screen("dashboard")


def run_tui(target_dir: Path | None = None) -> None:
    """Run the TUI application."""
    app = FeishuAgentApp(target_dir)
    app.run()


if __name__ == "__main__":
    run_tui()
