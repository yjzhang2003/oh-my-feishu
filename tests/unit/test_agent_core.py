from unittest.mock import MagicMock, patch

import pytest

from agent.core import AgentCore, TOOL_MAP


def test_load_system_prompt():
    core = AgentCore(api_key="dummy")
    prompt = core._load_system_prompt()
    assert "FeishuAgent" in prompt


def test_tool_map_exists():
    assert "read_log" in TOOL_MAP
    assert "read_code" in TOOL_MAP
    assert "run_test" in TOOL_MAP
    assert "git_commit" in TOOL_MAP
    assert "git_push" in TOOL_MAP
    assert "send_feishu_card" in TOOL_MAP


def test_run_task_no_tool_use():
    core = AgentCore(api_key="dummy")

    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="text", text="All good")]

    with patch.object(core.client.messages, "create", return_value=mock_response):
        result = core.run_task("Hello")
        assert result == "All good"


def test_run_task_with_tool_use():
    core = AgentCore(api_key="dummy")

    # First response: tool_use
    tool_block = MagicMock(type="tool_use", name="read_log", input={"path": "/tmp/test.log"}, id="tool_1")
    text_block = MagicMock(type="text", text="Let me check")
    resp1 = MagicMock()
    resp1.content = [text_block, tool_block]

    # Second response: final text
    resp2 = MagicMock()
    resp2.content = [MagicMock(type="text", text="Log shows error")]

    with patch.object(core.client.messages, "create", side_effect=[resp1, resp2]):
        with patch("agent.core.TOOL_MAP", {"read_log": lambda **kw: "ERROR: boom"}):
            result = core.run_task("Check the log")
            assert result == "Log shows error"
