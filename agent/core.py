import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from anthropic import Anthropic

from agent.tools.git_commit import git_commit, git_push
from agent.tools.read_code import read_code
from agent.tools.read_log import read_log
from agent.tools.run_test import run_test
from agent.tools.send_feishu_card import send_feishu_card
from hooks.manager import HookManager
from skills.registry import SkillRegistry

logger = logging.getLogger(__name__)

TOOL_MAP = {
    "read_log": read_log,
    "read_code": read_code,
    "run_test": run_test,
    "git_commit": git_commit,
    "git_push": git_push,
    "send_feishu_card": send_feishu_card,
}

BUILTIN_TOOL_SCHEMAS = [
    {
        "name": "read_log",
        "description": "Read a log file or its last N lines.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to log file"},
                "lines": {"type": "integer", "description": "Number of tail lines (optional)"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "read_code",
        "description": "Read source code file with optional line range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path to source file"},
                "start_line": {"type": "integer", "description": "Start line (1-based, optional)"},
                "end_line": {"type": "integer", "description": "End line (1-based, optional)"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_test",
        "description": "Run pytest on a target path or module.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target": {"type": "string", "description": "Path or module to test (default: .)"},
                "timeout": {"type": "integer", "description": "Timeout in seconds (default: 120)"},
            },
        },
    },
    {
        "name": "git_commit",
        "description": "Stage files and commit to git.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo_path": {"type": "string", "description": "Absolute path to git repo"},
                "message": {"type": "string", "description": "Commit message"},
                "branch": {"type": "string", "description": "New branch name (optional)"},
                "files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific files to stage (optional)",
                },
            },
            "required": ["repo_path", "message"],
        },
    },
    {
        "name": "git_push",
        "description": "Push a git branch to remote.",
        "input_schema": {
            "type": "object",
            "properties": {
                "repo_path": {"type": "string", "description": "Absolute path to git repo"},
                "branch": {"type": "string", "description": "Branch to push"},
                "remote": {"type": "string", "description": "Remote name (default: origin)"},
            },
            "required": ["repo_path", "branch"],
        },
    },
    {
        "name": "send_feishu_card",
        "description": "Send an interactive Feishu card message.",
        "input_schema": {
            "type": "object",
            "properties": {
                "receive_id": {"type": "string", "description": "User or chat open_id"},
                "card_content": {"type": "object", "description": "Feishu card JSON dict"},
                "receive_id_type": {"type": "string", "description": "ID type (default: open_id)"},
            },
            "required": ["receive_id", "card_content"],
        },
    },
]


class AgentCore:
    """Claude Agent SDK orchestration layer."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        skill_registry: Optional[SkillRegistry] = None,
        hook_manager: Optional[HookManager] = None,
    ) -> None:
        kwargs = {}
        _api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if _api_key:
            kwargs["api_key"] = _api_key
            
        _base_url = base_url or os.environ.get("ANTHROPIC_BASE_URL")
        if _base_url:
            kwargs["base_url"] = _base_url
            
        self.client = Anthropic(**kwargs)
        self.model = model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        self.skill_registry = skill_registry or SkillRegistry()
        self.hook_manager = hook_manager or HookManager()
        self._tools: List[Dict[str, Any]] = []

    def _build_tools(self) -> List[Dict[str, Any]]:
        tools = list(BUILTIN_TOOL_SCHEMAS)
        for skill in self.skill_registry.load_all().values():
            for tool in skill.get_tools():
                # Normalize skill tools to Anthropic format
                if "function" in tool:
                    func = tool["function"]
                    tools.append(
                        {
                            "name": func["name"],
                            "description": func["description"],
                            "input_schema": func.get("parameters", {"type": "object", "properties": {}}),
                        }
                    )
        return tools

    def run_task(self, user_prompt: str, system_prompt: Optional[str] = None, max_turns: int = 20) -> str:
        """Run a conversation loop with tool use."""
        tools = self._build_tools()
        messages: List[Dict[str, Any]] = [{"role": "user", "content": user_prompt}]

        for turn in range(max_turns):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=system_prompt or self._load_system_prompt(),
                    tools=tools,
                    messages=messages,
                )
            except Exception as exc:
                logger.error("Anthropic API error: %s", exc)
                return f"API error: {exc}"

            # Collect assistant content blocks
            assistant_content = []
            for block in response.content:
                assistant_content.append(block)

            # If no tool_use, we are done
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if not tool_uses:
                text_parts = [b.text for b in response.content if b.type == "text"]
                return "\n".join(text_parts)

            # Append assistant message
            messages.append(
                {
                    "role": "assistant",
                    "content": [
                        {"type": b.type, **b.model_dump(exclude={"type"})} for b in response.content
                    ],
                }
            )

            # Execute tools and build tool_result messages
            tool_results = []
            for block in tool_uses:
                name = block.name
                args = block.input
                tool_id = block.id

                self.hook_manager.emit("before_tool_call", tool_name=name, args=args)
                result = self._invoke_tool(name, args)
                self.hook_manager.emit("after_tool_call", tool_name=name, result=result)

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": json.dumps(result),
                    }
                )

            messages.append({"role": "user", "content": tool_results})

        return "Max turns reached."

    def _invoke_tool(self, name: str, args: Dict[str, Any]) -> Any:
        func = TOOL_MAP.get(name)
        if func is None:
            # Try skills
            for skill in self.skill_registry.load_all().values():
                for tool in skill.get_tools():
                    if tool.get("function", {}).get("name") == name:
                        method = getattr(skill, name, None)
                        if method:
                            return method(**args)
            return {"error": f"Tool not found: {name}"}
        try:
            return func(**args)
        except Exception as exc:
            logger.error("Tool %s failed: %s", name, exc)
            return {"error": str(exc)}

    @staticmethod
    def _load_system_prompt() -> str:
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.md"
        if prompt_path.exists():
            return prompt_path.read_text(encoding="utf-8")
        return "You are a helpful assistant."
