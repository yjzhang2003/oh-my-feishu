"""Claude Code configuration screen."""

from textual.app import ComposeResult
from textual.containers import Container, Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Header, Footer, Button, Static, Input
from textual.validation import Length
from pathlib import Path
import json


class ClaudeSetupScreen(Screen):
    """Screen for configuring Claude Code API key."""

    CSS = """
    ClaudeSetupScreen {
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

    def compose(self) -> ComposeResult:
        yield Header()

        with Container(classes="setup-container"):
            yield Static("Claude Code Configuration", classes="title")

            with Vertical(classes="form-group"):
                yield Static("API Key (ANTHROPIC_API_KEY):", classes="form-label")
                yield Input(
                    placeholder="sk-ant-...",
                    id="api-key",
                    password=True,
                )

            yield Static(
                "The API key will be stored in ~/.claude/settings.json",
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
            self._save_api_key()

    def _save_api_key(self) -> None:
        """Save the API key to settings.json."""
        api_key = self.query_one("#api-key", Input).value.strip()
        if not api_key:
            return

        settings_path = Path.home() / ".claude" / "settings.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        # Load existing settings or create new
        if settings_path.exists():
            try:
                data = json.loads(settings_path.read_text())
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}

        # Update env
        if "env" not in data:
            data["env"] = {}

        data["env"]["ANTHROPIC_API_KEY"] = api_key

        # Save
        settings_path.write_text(json.dumps(data, indent=2))

        # Go back to dashboard
        self.app.pop_screen()
