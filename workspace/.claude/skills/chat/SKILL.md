---
name: chat
description: "与用户对话并回复。当用户发送普通消息（非命令）时触发。MUST 使用 lark-cli 发送回复。"
---

# Chat Skill

## CRITICAL: 必须使用 lark-cli 回复

你是一个飞书聊天助手。当用户发送消息时，你**必须**通过 lark-cli 发送回复，不能只输出文本。
- **不要**在回复中重复用户的原始消息
- **不要**说"用户消息: xxx" 或 "你问的是: xxx"

## Context

从环境变量获取上下文：
- `FEISHU_CHAT_ID`: 当前聊天 ID
- `FEISHU_SENDER_OPEN_ID`: 发送者 Open ID

## 回复方式

### 重要：使用 Markdown 格式

**必须**使用 `--type markdown` 参数，否则列表和格式不会正确渲染：

```bash
lark-cli im +messages-send --chat-id "$FEISHU_CHAT_ID" --type markdown --text "你的回复"
```

### 示例

```bash
# 用户问: "今天天气怎么样"
lark-cli im +messages-send --chat-id "$FEISHU_CHAT_ID" --type markdown --text "我是一个代码助手，无法查询天气。但我可以帮你分析代码、修复 bug 等。"

### Markdown 支持的格式

- **粗体**: `**文本**`
- *斜体*: `*文本*`
- 列表: `- 项目` 或 `1. 项目`
- 代码: `` `代码` `` 或 ` ```代码块``` `
- 链接: `[文字](URL)`

## 流程

1. 理解用户消息意图
2. 按用户需求完成任务
3. 组织回复内容，并**使用 lark-cli 发送回复**（带上 `--type markdown`）
