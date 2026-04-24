import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

FEISHU_API_BASE = "https://open.feishu.cn/open-apis"


class FeishuBot:
    """Lightweight Feishu message sender. No agent logic here — that lives in Claude Code skills."""

    def __init__(
        self,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
    ) -> None:
        self.app_id = app_id or os.environ.get("FEISHU_APP_ID", "")
        self.app_secret = app_secret or os.environ.get("FEISHU_APP_SECRET", "")
        self._token: Optional[str] = None

    def _get_token(self) -> Optional[str]:
        if self._token:
            return self._token
        url = f"{FEISHU_API_BASE}/auth/v3/tenant_access_token/internal"
        resp = httpx.post(
            url, json={"app_id": self.app_id, "app_secret": self.app_secret}, timeout=10.0
        )
        data = resp.json()
        self._token = data.get("tenant_access_token")
        return self._token

    def send_message(
        self,
        receive_id: str,
        content: Dict[str, Any],
        msg_type: str = "interactive",
        receive_id_type: str = "open_id",
    ) -> Dict[str, Any]:
        token = self._get_token()
        if not token:
            return {"error": "No tenant_access_token"}

        url = f"{FEISHU_API_BASE}/im/v1/messages?receive_id_type={receive_id_type}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        body = {
            "receive_id": receive_id,
            "msg_type": msg_type,
            "content": json.dumps(content),
        }
        try:
            resp = httpx.post(url, headers=headers, json=body, timeout=10.0)
            return resp.json()
        except Exception as exc:
            logger.error("send_message failed: %s", exc)
            return {"error": str(exc)}

    def send_text(self, receive_id: str, text: str) -> Dict[str, Any]:
        return self.send_message(receive_id, {"text": text}, msg_type="text")

    def dispatch(self, event_type: str, user_id: str, message: str) -> Optional[str]:
        """Simple dispatcher for slash commands. Returns reply text."""
        text = message.strip()

        if text.startswith("/"):
            parts = text[1:].split(None, 1)
            cmd = parts[0]
            if cmd == "status":
                return "Agent is running. Skills: auto-repair, analyze-log, safety-check, notify-feishu"
            if cmd == "repair":
                return "Repair triggered. Check .claude/triggers/ for progress."
            return f"Unknown command: {cmd}. Supported: /repair, /status"

        return f"Echo: {text}. Use /repair to start auto-repair."
