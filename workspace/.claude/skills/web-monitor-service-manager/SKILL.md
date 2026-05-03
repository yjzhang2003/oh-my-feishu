---
name: web-monitor-service-manager
description: "Web Monitor helper. Manage oh-my-feishu Web Monitor services through the Gateway-backed CLI."
metadata:
  category: "devops"
  requires:
    bins: ["oh-my-feishu"]
---

# Web Monitor Service Manager

Use this skill when the user asks to list, inspect, add, remove, enable, disable, or update oh-my-feishu Web Monitor services.

## Principle

Do not edit `workspace/.claude/services.json` directly. Web Monitor service operations must go through the oh-my-feishu CLI so validation, shallow clone, deletion, Gateway events, and future side effects remain centralized.

## Commands

### List services

```bash
oh-my-feishu web-monitor list
```

### Inspect one service

```bash
oh-my-feishu web-monitor get <name>
```

### Add a service

```bash
oh-my-feishu web-monitor add <name> <owner/repo> <traceback_url> [--chat-id <chat_id>]
```

Adding a service shallow-clones the GitHub repository into the controlled workspace service directory and registers it with the Gateway `service-admin` feature.

### Remove a service

```bash
oh-my-feishu web-monitor remove <name>
```

Removing a service deletes the registry entry and removes the controlled local service repository when present.

### Enable or disable a service

```bash
oh-my-feishu web-monitor enable <name>
oh-my-feishu web-monitor disable <name>
```

### Update service configuration

```bash
oh-my-feishu web-monitor update <name> \
  [--repo <owner/repo>] \
  [--traceback-url <url>] \
  [--chat-id <chat_id>] \
  [--interval <seconds>]
```

Updating `--traceback-url` resets the cached traceback hash and preview so the monitor establishes a fresh baseline for the new URL.

## Safety Rules

1. Confirm destructive operations before running `remove`.
2. Prefer `get <name>` before `update`, `enable`, `disable`, or `remove`.
3. Do not modify service repositories while managing the monitor registry.
4. If the CLI reports that Gateway is unavailable, tell the user the oh-my-feishu PM2 service must be running.
5. Do not expose or guess Feishu chat IDs. Only use `--chat-id` if the user provides one or the surrounding oh-my-feishu context already supplies it.

## Output

Summarize the CLI result in plain language:

- operation performed
- affected service
- current status or changed fields
- any errors and next steps
