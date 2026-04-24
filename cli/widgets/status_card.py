"""Status card widget for displaying component status."""

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.widgets import Static, Button
from textual.reactive import reactive


class StatusCard(Vertical):
    """A card widget showing component status with action buttons."""

    DEFAULT_CSS = """
    StatusCard {
        width: 1fr;
        height: auto;
        min-height: 8;
        border: solid $primary;
        padding: 1;
        margin: 1;
    }

    StatusCard.configured {
        border: solid $success;
    }

    StatusCard.not-configured {
        border: solid $error;
    }

    StatusCard .title {
        text-style: bold;
        margin-bottom: 1;
    }

    StatusCard .status {
        color: $text-muted;
        margin-bottom: 1;
    }

    StatusCard .actions {
        height: auto;
        align: center middle;
    }

    StatusCard Button {
        margin: 0 1;
        min-width: 12;
    }
    """

    component_name: reactive[str] = reactive("")
    status_text: reactive[str] = reactive("")
    is_configured: reactive[bool] = reactive(False)

    def __init__(
        self,
        component_name: str,
        status_text: str = "Not configured",
        is_configured: bool = False,
        *,
        name: str | None = None,
        id: str | None = None,
    ):
        super().__init__(name=name, id=id)
        self.component_name = component_name
        self.status_text = status_text
        self.is_configured = is_configured

    def watch_is_configured(self, configured: bool) -> None:
        if configured:
            self.remove_class("not-configured")
            self.add_class("configured")
        else:
            self.remove_class("configured")
            self.add_class("not-configured")

    def compose(self) -> ComposeResult:
        icon = "✓" if self.is_configured else "✗"
        self.watch_is_configured(self.is_configured)

        yield Static(f"{icon} {self.component_name}", classes="title")
        yield Static(self.status_text, classes="status")
        with Horizontal(classes="actions"):
            if self.is_configured:
                yield Button("Reset", id="reset", variant="warning")
                yield Button("Re-configure", id="configure", variant="primary")
            else:
                yield Button("Configure", id="configure", variant="success")

    def update_status(self, is_configured: bool, status_text: str) -> None:
        """Update the card's status display."""
        self.is_configured = is_configured
        self.status_text = status_text

        # Update widgets
        icon = "✓" if is_configured else "✗"
        self.query_one(".title", Static).update(f"{icon} {self.component_name}")
        self.query_one(".status", Static).update(status_text)
