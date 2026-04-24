from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from gateway import webhook_server as server
from gateway.bot import FeishuBot
from gateway.webhook_server import app, set_bot


@pytest.fixture(autouse=True)
def reset_bot():
    server._bot = None


def test_url_verification():
    client = TestClient(app)
    resp = client.post("/webhook", json={"type": "url_verification", "challenge": "abc123"})
    assert resp.status_code == 200
    assert resp.json()["challenge"] == "abc123"


def test_ignore_non_text_message():
    client = TestClient(app)
    payload = {"event": {"message": {"message_type": "image"}}}
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


def test_dispatch_text_message():
    mock_bot = MagicMock(spec=FeishuBot)
    mock_bot.dispatch.return_value = "Hello back"
    set_bot(mock_bot)

    client = TestClient(app)
    payload = {
        "event": {
            "message": {
                "message_type": "text",
                "content": '{"text": "hello"}',
            },
            "sender": {"sender_id": {"open_id": "u1"}},
        }
    }
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    mock_bot.dispatch.assert_called_once()
