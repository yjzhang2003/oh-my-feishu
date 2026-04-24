import json
import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

FEISHU_API_BASE = "https://open.feishu.cn/open-apis"


def _get_tenant_access_token(app_id: str, app_secret: str) -> Optional[str]:
    url = f"{FEISHU_API_BASE}/auth/v3/tenant_access_token/internal"
    resp = httpx.post(url, json={"app_id": app_id, "app_secret": app_secret}, timeout=10.0)
    data = resp.json()
    return data.get("tenant_access_token")


def send_feishu_card(
    receive_id: str,
    card_content: Dict[str, Any],
    receive_id_type: str = "open_id",
) -> Dict[str, Any]:
    """Send an interactive card message to a Feishu user or group.

    Args:
        receive_id: User or chat open_id.
        card_content: Feishu interactive card JSON dict.
        receive_id_type: "open_id" | "user_id" | "union_id" | "email" | "chat_id".

    Returns:
        API response dict.
    """
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    if not app_id or not app_secret:
        return {"error": "Missing FEISHU_APP_ID or FEISHU_APP_SECRET"}

    token = _get_tenant_access_token(app_id, app_secret)
    if not token:
        return {"error": "Failed to obtain tenant_access_token"}

    url = f"{FEISHU_API_BASE}/im/v1/messages?receive_id_type={receive_id_type}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "receive_id": receive_id,
        "msg_type": "interactive",
        "content": json.dumps(card_content),
    }

    try:
        resp = httpx.post(url, headers=headers, json=body, timeout=10.0)
        return resp.json()
    except Exception as exc:
        logger.error("send_feishu_card failed: %s", exc)
        return {"error": str(exc)}
