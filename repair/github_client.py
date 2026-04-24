import base64
import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


class GitHubClient:
    """Thin wrapper around GitHub REST API for PR creation."""

    def __init__(
        self,
        token: Optional[str] = None,
        owner: Optional[str] = None,
        repo: Optional[str] = None,
    ) -> None:
        self.token = token or os.environ.get("GITHUB_TOKEN", "")
        self.owner = owner or os.environ.get("GITHUB_REPO_OWNER", "")
        self.repo = repo or os.environ.get("GITHUB_REPO_NAME", "")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def create_pr(
        self,
        title: str,
        body: str = "",
        head: str = "",
        base: str = "main",
    ) -> Dict[str, Any]:
        url = f"{GITHUB_API}/repos/{self.owner}/{self.repo}/pulls"
        payload = {"title": title, "body": body, "head": head, "base": base}
        try:
            resp = httpx.post(url, headers=self.headers, json=payload, timeout=30.0)
            data = resp.json()
            if resp.status_code in (200, 201):
                return {"success": True, "pr_url": data.get("html_url"), "pr_number": data.get("number")}
            return {"success": False, "error": data.get("message", resp.text)}
        except Exception as exc:
            logger.error("create_pr failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_default_branch(self) -> str:
        url = f"{GITHUB_API}/repos/{self.owner}/{self.repo}"
        try:
            resp = httpx.get(url, headers=self.headers, timeout=10.0)
            data = resp.json()
            return data.get("default_branch", "main")
        except Exception:
            return "main"
