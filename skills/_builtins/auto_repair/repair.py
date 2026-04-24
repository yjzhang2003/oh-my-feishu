import logging
import subprocess
from typing import Any, Dict, List

from skills.registry import Skill

logger = logging.getLogger(__name__)


class AutoRepairSkill(Skill):
    """Built-in skill for automated code repair workflow."""

    def load(self) -> None:
        logger.info("AutoRepairSkill loaded")
        self.register_tool(
            {
                "type": "function",
                "function": {
                    "name": "run_tests",
                    "description": "Run the project test suite and return results.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target": {
                                "type": "string",
                                "description": "Path or module to test",
                                "default": ".",
                            }
                        },
                    },
                },
            }
        )
        self.register_tool(
            {
                "type": "function",
                "function": {
                    "name": "submit_pr",
                    "description": "Create a GitHub pull request with the current branch changes.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "PR title",
                            },
                            "body": {
                                "type": "string",
                                "description": "PR description",
                            },
                        },
                        "required": ["title"],
                    },
                },
            }
        )

    def unload(self) -> None:
        logger.info("AutoRepairSkill unloaded")

    def run_tests(self, target: str = ".") -> Dict[str, Any]:
        try:
            result = subprocess.run(
                ["pytest", target, "-v", "--tb=short"],
                capture_output=True,
                text=True,
                timeout=120,
            )
            return {
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "passed": result.returncode == 0,
            }
        except Exception as exc:
            return {"error": str(exc), "passed": False}

    def submit_pr(self, title: str, body: str = "") -> Dict[str, Any]:
        return {"status": "not_implemented", "message": "Use repair.github_client directly"}


# Required alias for SkillRegistry loader
SkillImpl = AutoRepairSkill
