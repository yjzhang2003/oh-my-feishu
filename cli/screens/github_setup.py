"""GitHub configuration screen."""

from textual.app import ComposeResult
from textual.containers import Container, Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Header, Footer, Button, Static
from textual.worker import Worker

from cli.status import check_github
import subprocess


class GithubSetupScreen(Screen):
    """Screen for configuring GitHub authentication."""

    CSS = """
    GithubSetupScreen {
        align: center middle;
    }

    .setup-container {
        width: 60;
        height: auto;
        padding: 2;
        border: solid $primary;
    }

    .title {
        text-align: center;
        text-style: bold;
        color: $primary;
        margin-bottom: 2;
    }

    .status {
        text-align: center;
        margin-bottom: 1;
    }

    .status.success {
        color: $success;
    }

    .status.error {
        color: $error;
    }

    .actions {
        dock: bottom;
        height: auto;
        padding: 1;
        align: center middle;
    }

    .actions Button {
        margin: 0 1;
    }
    """

    BINDINGS = [
        ("escape", "back", "Back"),
    ]

    def compose(self) -> ComposeResult:
        yield Header()

        with Container(classes="setup-container"):
            yield Static("GitHub Authentication", classes="title")

            status = check_github()
            status_class = "success" if status.is_configured else "error"
            yield Static(
                status.message if status.message else "Not configured",
                classes=f"status {status_class}",
                id="status-text"
            )

            yield Static(
                "\nClick 'Login with gh' to authenticate via OAuth.\n"
                "A browser window will open for GitHub login.",
                classes="status"
            )

        with Horizontal(classes="actions"):
            yield Button("Back", id="back-btn", variant="default")
            if not check_github().is_configured:
                yield Button("Login with gh", id="login-btn", variant="success")
            else:
                yield Button("Logout", id="logout-btn", variant="warning")

        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "back-btn":
            self.app.pop_screen()
        elif event.button.id == "login-btn":
            self._do_login()
        elif event.button.id == "logout-btn":
            self._do_logout()

    def _do_login(self) -> None:
        """Run gh auth login."""
        # Run gh auth login interactively
        result = subprocess.run(
            ["gh", "auth", "login", "--git-protocol", "https", "--web"],
        )

        # Refresh status
        self._refresh_status()

    def _do_logout(self) -> None:
        """Run gh auth logout."""
        subprocess.run(["gh", "auth", "logout", "--hostname", "github.com"])
        self._refresh_status()

    def _refresh_status(self) -> None:
        """Refresh the status display."""
        status = check_github()
        status_text = self.query_one("#status-text", Static)
        status_class = "success" if status.is_configured else "error"
        status_text.update(status.message)
        status_text.set_class(status.is_configured, "success")
        status_text.set_class(not status.is_configured, "error")
