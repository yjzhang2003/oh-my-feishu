"""ECC plugin configuration screen."""

from textual.app import ComposeResult
from textual.containers import Container, Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Header, Footer, Button, Static

from cli.status import check_ecc
import subprocess


class EccSetupScreen(Screen):
    """Screen for configuring ECC plugin."""

    CSS = """
    EccSetupScreen {
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

    .info {
        color: $text-muted;
        text-align: center;
        margin-top: 1;
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
            yield Static("ECC Plugin Configuration", classes="title")

            status = check_ecc()
            status_class = "success" if status.is_configured else "error"
            yield Static(
                status.message if status.message else "Not installed",
                classes=f"status {status_class}",
                id="status-text"
            )

            yield Static(
                "\nECC (Everything Claude Code) provides enhanced skills,\n"
                "agents, and hooks for Claude Code.\n\n"
                "GitHub: https://github.com/affaan-m/everything-claude-code",
                classes="info"
            )

        with Horizontal(classes="actions"):
            yield Button("Back", id="back-btn", variant="default")
            if not check_ecc().is_configured:
                yield Button("Install ECC", id="install-btn", variant="success")
            else:
                yield Button("Check Updates", id="update-btn", variant="primary")

        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "back-btn":
            self.app.pop_screen()
        elif event.button.id == "install-btn":
            self._install_ecc()
        elif event.button.id == "update-btn":
            self._update_ecc()

    def _install_ecc(self) -> None:
        """Install ECC plugin."""
        result = subprocess.run(
            ["claude", "plugins", "install", "everything-claude-code@everything-claude-code"],
            capture_output=True,
            text=True,
        )
        self._refresh_status()

    def _update_ecc(self) -> None:
        """Update ECC plugin."""
        result = subprocess.run(
            ["claude", "plugins", "update", "everything-claude-code@everything-claude-code"],
            capture_output=True,
            text=True,
        )
        self._refresh_status()

    def _refresh_status(self) -> None:
        """Refresh the status display."""
        status = check_ecc()
        status_text = self.query_one("#status-text", Static)
        status_class = "success" if status.is_configured else "error"
        status_text.update(status.message)
        status_text.set_class(status.is_configured, "success")
        status_text.set_class(not status.is_configured, "error")
