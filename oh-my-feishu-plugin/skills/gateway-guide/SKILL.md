---
name: gateway-guide
version: 0.1.0
description: "oh-my-feishu Gateway 功能入口。用于列出或触发 Gateway features，例如 status、service-admin、repair、web-monitor。"
metadata:
  category: "automation"
  requires:
    bins: ["oh-my-feishu"]
---

# Gateway Guide

当用户请求 oh-my-feishu Gateway 能力、后台自动化能力、服务监控能力，或需要从 Claude Code 主进程触发 Gateway feature 时使用本技能。

## 原则

- 普通问答不要使用 Gateway。
- 飞书 API 操作优先使用 `lark-chat-guide` 和对应 lark 技能。
- Gateway feature 是后台任务入口，默认只返回最终结果。
- 触发前先用 `oh-my-feishu gateway list` 查看当前可用 feature。

## 命令

```bash
oh-my-feishu gateway list
oh-my-feishu gateway status
oh-my-feishu gateway trigger <feature> <eventType> '<jsonPayload>'
```

## 常见入口

### 查询 Gateway 状态

```bash
oh-my-feishu gateway status
```

### 触发服务管理

```bash
oh-my-feishu gateway trigger service-admin service.command '{"action":"list"}'
```

### 触发修复任务

```bash
oh-my-feishu gateway trigger repair repair.requested '{"context":"用户描述的问题"}'
```

## 输出处理

CLI 会输出 JSON。面向用户时，提取 `success`、`message`、`data` 中的关键信息，用自然语言总结。不要把大段原始 JSON 直接贴给用户，除非用户明确要求。
