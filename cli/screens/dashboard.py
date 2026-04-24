"""Dashboard screen showing all component statuses."""

from pathlib import Path

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Header, Footer, Button, Static

from cli.widgets.status_card import StatusCard
from cli.status import get_all_status, ComponentStatus


class DashboardScreen(Screen):
    """Main dashboard showing component status cards."""

    CSS = """
    DashboardScreen {
        align: center middle;
    }

    .dashboard-container {
        width: 80;
        height: auto;
        padding: 1;
    }

    .title {
        text-align: center;
        text-style: bold;
        color: $primary;
        margin-bottom: 2;
    }

    .cards-grid {
        layout: grid;
        grid-size: 2;
        grid-columns: 1fr 1fr;
        column-gap: 2;
        row-gap: 1;
    }

    .footer-actions {
        dock: bottom;
        height: auto;
        padding: 1;
        align: center middle;
    }

    .footer-actions Button {
        margin: 0 1;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("r", "refresh", "Refresh"),
    ]

    def __init__(self, target_dir: Path | None = None):
        super().__init__()
        self.target_dir = target_dir or Path.cwd()

    def compose(self) -> ComposeResult:
        yield Header()

        with Container(classes="dashboard-container"):
            yield Static("Feishu Agent Setup Dashboard", classes="title")

            with Vertical(classes="cards-grid"):
                # Cards will be added dynamically
                pass

        with Horizontal(classes="footer-actions"):
            yield Button("Refresh", id="refresh-btn", variant="default")
            yield Button("Exit", id="exit-btn", variant="error")

        yield Footer()

    def on_mount(self) -> None:
        """Load status and create cards."""
        self._refresh_status()

    def _refresh_status(self) -> None:
        """Refresh all component statuses."""
        statuses = get_all_status(self.target_dir)

        # Get the cards grid container
        grid = self.query_one(".cards-grid", Vertical)
        grid.remove_children()

        # Create status cards
        card_ids = {
            "claude": "claude-card",
            "feishu": "feishu-card",
            "github": "github-card",
            "ecc": "ecc-card",
        }

        for key, status in statuses.items():
            card = StatusCard(
                component_name=status.name,
                status_text=status.message,
                is_configured=status.is_configured,
                id=card_ids[key],
            )
            grid.mount(card)

    def action_refresh(self) -> None:
        """Refresh button action."""
        self._refresh_status()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        button_id = event.button.id

        if button_id == "exit-btn":
            self.app.exit()
        elif button_id == "refresh-btn":
            self._refresh_status()
        elif button_id == "configure":
            # Find which card was clicked
            card = event.button.ancestors_with_self(StatusCard)
            for c in card:
                if c.id == "claude-card":
                    self.app.push_screen("claude-setup")
                elif c.id == "feishu-card":
                    self.app.push_screen("feishu-setup")
                elif c.id == "github-card":
                    self.app.push_screen("github-setup")
                elif c.id == "ecc-card":
                    self.app.push_screen("ecc-setup")
                break
        elif button_id == "reset":
            # Handle reset
            card = event.button.ancestors_with_self(StatusCard)
            for c in card:
                self._handle_reset(c.id)
                break

    def _handle_reset(self, card_id: str) -> None:
        """Handle reset action for a component."""
        # TODO: Implement reset logic for each component
        if card_id == "claude-card":
            # Reset Claude Code settings
            pass
        elif card_id == "feishu-card":
            # Reset Feishu credentials
            pass
        elif card_id == "github-card":
            # Reset GitHub auth
            pass
        elif card_id == "ecc-card":
            # ECC can't be reset from CLI
            pass
