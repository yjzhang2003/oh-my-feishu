from unittest.mock import MagicMock, patch

import pytest

from gateway.bot import FeishuBot
from gateway.card_builder import build_repair_card, build_text_card


class TestCardBuilder:
    def test_build_repair_card(self):
        card = build_repair_card("Bug Fixed", "Fixed div by zero", "http://pr/1", diff_preview="- old\n+ new")
        assert card["header"]["title"]["content"] == "Bug Fixed"
        assert any("Diff Preview" in str(el) for el in card["elements"])

    def test_build_text_card(self):
        card = build_text_card("Hello world")
        assert card["elements"][0]["text"]["content"] == "Hello world"


class TestFeishuBot:
    @patch("gateway.bot.httpx.post")
    def test_get_token(self, mock_post):
        mock_post.return_value = MagicMock(json=lambda: {"tenant_access_token": "tok123"})
        bot = FeishuBot(app_id="a", app_secret="s")
        assert bot._get_token() == "tok123"

    @patch("gateway.bot.httpx.post")
    def test_send_message(self, mock_post):
        mock_post.return_value = MagicMock(json=lambda: {"code": 0})
        bot = FeishuBot(app_id="a", app_secret="s")
        bot._token = "tok123"
        result = bot.send_message("u1", {"text": "hi"}, msg_type="text")
        assert result.get("code") == 0

    def test_dispatch_command_status(self):
        bot = FeishuBot()
        reply = bot.dispatch("command", "u1", "/status")
        assert "running" in reply.lower()

    def test_dispatch_command_unknown(self):
        bot = FeishuBot()
        reply = bot.dispatch("command", "u1", "/foobar")
        assert "Unknown" in reply

    def test_dispatch_non_command_echo(self):
        bot = FeishuBot()
        reply = bot.dispatch("message", "u1", "hello")
        assert "Echo:" in reply

    def test_dispatch_repair_command(self):
        bot = FeishuBot()
        reply = bot.dispatch("command", "u1", "/repair")
        assert "Repair triggered" in reply
