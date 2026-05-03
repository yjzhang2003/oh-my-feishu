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
oh-my-feishu web-monitor add <name> <owner/repo> <traceback_url> [--chat-id <chat_id>] [--auto-pr] [--pr-base <branch>] [--pr-ready]
```

Adding a service shallow-clones the GitHub repository into the controlled workspace service directory and registers it with the Gateway `service-admin` feature.

By default, auto PR is disabled. Add `--auto-pr` only when the user explicitly wants Web Monitor repairs to push a branch and open a PR automatically.

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
  [--interval <seconds>] \
  [--auto-pr|--no-auto-pr] \
  [--pr-base <branch>] \
  [--pr-draft|--pr-ready] \
  [--pr-branch-prefix <prefix>]
```

Updating `--traceback-url` resets the cached traceback hash and preview so the monitor establishes a fresh baseline for the new URL.

PR-related flags:

- `--auto-pr`: after a successful repair, create a branch, commit, push, and open a PR.
- `--no-auto-pr`: keep repairs local and only report the result.
- `--pr-base <branch>`: target branch for the PR, default `main`.
- `--pr-draft` / `--pr-ready`: create draft PRs by default; use ready PRs only when requested.
- `--pr-branch-prefix <prefix>`: branch prefix for generated repair branches.

## Safety Rules

1. Confirm destructive operations before running `remove`.
2. Prefer `get <name>` before `update`, `enable`, `disable`, or `remove`.
3. Do not modify service repositories while managing the monitor registry.
4. If the CLI reports that Gateway is unavailable, tell the user the oh-my-feishu PM2 service must be running.
5. Do not expose or guess Feishu chat IDs. Only use `--chat-id` if the user provides one or the surrounding oh-my-feishu context already supplies it.
6. Do not enable auto PR unless the user explicitly asks for automatic PR submission.

## Output

Summarize the CLI result in plain language:

- operation performed
- affected service
- current status or changed fields
- any errors and next steps
