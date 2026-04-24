from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from gateway import webhook_server as server
from gateway.webhook_server import app


def test_url_verification():
    client = TestClient(app)
    resp = client.post("/webhook", json={"type": "url_verification", "challenge": "abc123"})
    assert resp.status_code == 200
    assert resp.json()["challenge"] == "abc123"


def test_invalid_json_webhook():
    client = TestClient(app)
    resp = client.post("/webhook", content=b"not json")
    assert resp.status_code == 400


def test_ignore_non_text_message():
    client = TestClient(app)
    payload = {"event": {"message": {"message_type": "image"}}}
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


@patch("gateway.webhook_server.write_trigger")
def test_text_message_writes_trigger(mock_write_trigger):
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
    mock_write_trigger.assert_called_once()
    call_args = mock_write_trigger.call_args[0][0]
    assert call_args["source"] == "feishu_mention"
    assert call_args["sender_id"] == "u1"
    assert call_args["message"] == "hello"


@patch("gateway.webhook_server.run_repair_pipeline")
def test_repair_command(mock_run_repair):
    mock_run_repair.return_value = {"returncode": 0, "stdout": "done", "stderr": ""}
    client = TestClient(app)
    payload = {
        "event": {
            "message": {
                "message_type": "text",
                "content": '{"text": "/repair fix the bug"}',
            },
            "sender": {"sender_id": {"open_id": "u1"}},
        }
    }
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "triggered"
    mock_run_repair.assert_called_once_with(
        context="fix the bug",
        error_log="",
        source="feishu_manual",
    )


def test_status_command():
    client = TestClient(app)
    payload = {
        "event": {
            "message": {
                "message_type": "text",
                "content": '{"text": "/status"}',
            },
            "sender": {"sender_id": {"open_id": "u1"}},
        }
    }
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert "running" in resp.json()["message"].lower()


@patch("gateway.webhook_server.run_repair_pipeline")
def test_monitor_webhook(mock_run_repair):
    mock_run_repair.return_value = {"returncode": 0, "stdout": "fixed", "stderr": ""}
    client = TestClient(app)
    payload = {
        "error_log": "Traceback: ZeroDivisionError",
        "context": "Health check failed",
    }
    resp = client.post("/monitor", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "triggered"
    mock_run_repair.assert_called_once_with(
        context="Health check failed",
        error_log="Traceback: ZeroDivisionError",
        source="monitor",
    )


@patch("gateway.webhook_server.FEISHU_APP_SECRET", "secret123")
@patch("gateway.webhook_server._verify_signature")
def test_webhook_signature_required(mock_verify):
    mock_verify.return_value = False
    client = TestClient(app)
    payload = {
        "event": {
            "message": {"message_type": "text", "content": '{"text": "/status"}'},
            "sender": {"sender_id": {"open_id": "u1"}},
        }
    }
    resp = client.post(
        "/webhook",
        json=payload,
        headers={
            "X-Lark-Request-Timestamp": "123",
            "X-Lark-Request-Nonce": "abc",
            "X-Lark-Signature": "bad",
        },
    )
    assert resp.status_code == 401


@patch("gateway.webhook_server.MONITOR_API_KEY", "mon_secret")
def test_monitor_requires_api_key():
    client = TestClient(app)
    resp = client.post("/monitor", json={"context": "test"})
    assert resp.status_code == 401

    resp = client.post(
        "/monitor",
        json={"context": "test"},
        headers={"Authorization": "Bearer mon_secret"},
    )
    assert resp.status_code == 200


def test_malformed_message_content():
    client = TestClient(app)
    payload = {
        "event": {
            "message": {
                "message_type": "text",
                "content": "not json",
            },
            "sender": {"sender_id": {"open_id": "u1"}},
        }
    }
    resp = client.post("/webhook", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
