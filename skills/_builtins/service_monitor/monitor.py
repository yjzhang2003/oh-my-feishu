import logging
from typing import Any, Dict, List, Optional

import httpx

from skills.registry import Skill

logger = logging.getLogger(__name__)


class ServiceMonitorSkill(Skill):
    """Built-in skill for monitoring service health and logs."""

    def load(self) -> None:
        logger.info("ServiceMonitorSkill loaded")
        self.register_tool(
            {
                "type": "function",
                "function": {
                    "name": "check_health",
                    "description": "Check if a web service is healthy via HTTP GET.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {
                                "type": "string",
                                "description": "Health check URL",
                            }
                        },
                        "required": ["url"],
                    },
                },
            }
        )
        self.register_tool(
            {
                "type": "function",
                "function": {
                    "name": "read_log_tail",
                    "description": "Read the last N lines of a log file.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Log file path",
                            },
                            "lines": {
                                "type": "integer",
                                "description": "Number of lines to tail",
                                "default": 100,
                            },
                        },
                        "required": ["path"],
                    },
                },
            }
        )

    def unload(self) -> None:
        logger.info("ServiceMonitorSkill unloaded")

    def check_health(self, url: str) -> Dict[str, Any]:
        try:
            resp = httpx.get(url, timeout=10.0)
            return {"status_code": resp.status_code, "healthy": resp.status_code < 400}
        except Exception as exc:
            return {"error": str(exc), "healthy": False}

    def read_log_tail(self, path: str, lines: int = 100) -> str:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                all_lines = f.readlines()
                return "".join(all_lines[-lines:])
        except Exception as exc:
            return f"Error reading log: {exc}"


# Required alias for SkillRegistry loader
SkillImpl = ServiceMonitorSkill
