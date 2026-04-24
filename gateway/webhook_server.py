import hashlib
import hmac
import json
import logging
import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Request

from gateway.bot import FeishuBot
from gateway.trigger import run_repair_pipeline, write_trigger

logger = logging.getLogger(__name__)

app = FastAPI(title="Feishu Agent Gateway")

FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")
MONITOR_API_KEY = os.environ.get("MONITOR_API_KEY", "")


def _verify_signature(request_body: bytes, timestamp: str, nonce: str, signature: str, key: str) -> bool:
    """Verify Feishu request signature."""
    expected = hmac.new(key.encode(), f"{timestamp}{nonce}{request_body.decode()}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.post("/webhook")
async def webhook(request: Request) -> Dict[str, Any]:
    """Receive Feishu webhook events and forward to Claude Code skills."""
    body = await request.body()

    # Challenge verification (initial setup)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    # Verify Feishu signature in production
    if FEISHU_APP_SECRET:
        timestamp = request.headers.get("X-Lark-Request-Timestamp", "")
        nonce = request.headers.get("X-Lark-Request-Nonce", "")
        signature = request.headers.get("X-Lark-Signature", "")
        if not _verify_signature(body, timestamp, nonce, signature, FEISHU_APP_SECRET):
            raise HTTPException(status_code=401, detail="Invalid signature")

    event = payload.get("event", {})
    if not event:
        return {"status": "ignored", "reason": "no event"}

    msg_type = event.get("message", {}).get("message_type")
    if msg_type != "text":
        return {"status": "ignored", "reason": "non-text message"}

    text = event.get("message", {}).get("content", {})
    if isinstance(text, str):
        try:
            text = json.loads(text)
        except json.JSONDecodeError:
            return {"status": "ignored", "reason": "malformed content"}
    message_text = text.get("text", "").strip()

    sender = event.get("sender", {}).get("sender_id", {}).get("open_id", "")

    # Slash commands
    if message_text.startswith("/"):
        parts = message_text[1:].split(None, 1)
        cmd = parts[0]
        args = parts[1] if len(parts) > 1 else ""

        if cmd == "repair":
            try:
                result = run_repair_pipeline(
                    context=args or "Manual repair request",
                    error_log="",
                    source="feishu_manual",
                )
                return {"status": "triggered", "repair_returncode": result["returncode"]}
            except Exception as exc:
                logger.exception("Repair pipeline failed")
                return {"status": "error", "message": "Pipeline failed. Check gateway logs."}

        if cmd == "status":
            return {"status": "ok", "message": "Agent is running. Skills: auto-repair, analyze-log, safety-check, notify-feishu"}

    # @mention or P2P → forward message to trigger
    try:
        write_trigger(
            {
                "source": "feishu_mention",
                "sender_id": sender,
                "message": message_text,
                "event": event,
            }
        )
    except Exception as exc:
        logger.exception("Failed to write trigger")
        return {"status": "error", "message": "Failed to record trigger"}

    return {"status": "ok", "message": "Trigger recorded. Use /repair to start pipeline."}


@app.post("/monitor")
async def monitor_webhook(request: Request) -> Dict[str, Any]:
    """Receive monitor alerts (health check failures, log errors)."""
    # Simple API key auth for monitor endpoint
    if MONITOR_API_KEY:
        auth_header = request.headers.get("Authorization", "")
        if auth_header != f"Bearer {MONITOR_API_KEY}":
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    error_log = payload.get("error_log", "")
    context = payload.get("context", "Monitor alert")

    try:
        result = run_repair_pipeline(
            context=context,
            error_log=error_log,
            source="monitor",
        )
    except Exception as exc:
        logger.exception("Repair pipeline failed for monitor alert")
        return {"status": "error", "message": "Pipeline failed. Check gateway logs."}

    return {
        "status": "triggered",
        "repair_returncode": result["returncode"],
        "stdout_preview": result["stdout"][:200] if result["stdout"] else "",
    }
