"""Feishu configuration screen."""

from pathlib import Path

from textual.app import ComposeResult
from textual.containers import Container, Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Header, Footer, Button, Static, Input


class FeishuSetupScreen(Screen):
    """Screen for configuring Feishu bot credentials."""

    CSS = """
    FeishuSetupScreen {
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

    .form-group {
        margin-bottom: 1;
    }

    .form-label {
        margin-bottom: 1;
    }

    Input {
        width: 100%;
        margin-bottom: 1;
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

    .status {
        color: $text-muted;
        text-align: center;
        margin-top: 1;
    }
    """

    BINDINGS = [
        ("escape", "back", "Back"),
    ]

    def __init__(self, target_dir: Path | None = None):
        super().__init__()
        self.target_dir = target_dir or Path.cwd()

    def compose(self) -> ComposeResult:
        yield Header()

        with Container(classes="setup-container"):
            yield Static("Feishu Bot Configuration", classes="title")

            with Vertical(classes="form-group"):
                yield Static("App ID:", classes="form-label")
                yield Input(
                    placeholder="cli_xxx",
                    id="app-id",
                )

            with Vertical(classes="form-group"):
                yield Static("App Secret:", classes="form-label")
                yield Input(
                    placeholder="xxx",
                    id="app-secret",
                    password=True,
                )

            yield Static(
                "Tip: Run 'feishu-agent setup' for QR scan to auto-create a bot",
                classes="status"
            )

        with Horizontal(classes="actions"):
            yield Button("Cancel", id="cancel-btn", variant="default")
            yield Button("Save", id="save-btn", variant="success")

        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel-btn":
            self.app.pop_screen()
        elif event.button.id == "save-btn":
            self._save_credentials()

    def _save_credentials(self) -> None:
        """Save Feishu credentials to .env."""
        app_id = self.query_one("#app-id", Input).value.strip()
        app_secret = self.query_one("#app-secret", Input).value.strip()

        if not app_id or not app_secret:
            return

        env_path = self.target_dir / ".env"

        # Read existing .env or create new
        if env_path.exists():
            lines = env_path.read_text().split("\n")
        else:
            lines = []

        # Update or add Feishu credentials
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

        self.app.pop_screen()
