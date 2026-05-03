---
name: web-monitor-notify-feishu
description: >
  Web Monitor helper. Send a Feishu/Lark notification about auto-repair
  results when the Gateway runtime is not already publishing the final result.
allowed-tools: Bash(curl *) Bash(cat *) Read
---

# Feishu Notification Protocol

## Input

- `receive_id`: Feishu user or chat open_id (fallback: `NOTIFY_CHAT_ID` env var)
- `pr_url`: GitHub pull request URL
- `summary`: Brief description of the bug and fix
- `service_name`: (optional) Name of the service that had the bug
- `traceback_preview`: (optional) Short traceback preview (truncated to 300 chars)
- `diff_preview`: (optional) Short diff preview (truncated to 500 chars)

## Procedure

1. **Read env vars**
   - `NOTIFY_CHAT_ID` (used as fallback if `receive_id` is not provided)

2. **Prefer Gateway output**
   - In normal Web Monitor tasks, do not send a separate notification. The
     Gateway runtime sends the final stdout/stderr to Feishu.
   - Use this skill only when explicitly asked to send a separate card.

3. **Build interactive card**

   If `service_name` is provided, use the service-aware card:
   ```json
   {
     "config": {"wide_screen_mode": true},
     "header": {
       "title": {"tag": "plain_text", "content": "🛠️ {service_name} Bug 自动修复完成"},
       "template": "red"
     },
     "elements": [
       {
         "tag": "div",
         "text": {"tag": "lark_md", "content": "**Service:** {service_name}\n**Summary:**\n{summary}"}
       },
       {
         "tag": "div",
         "text": {"tag": "lark_md", "content": "**Traceback:**\n```{traceback_preview_truncated}```"}
       },
       {
         "tag": "action",
         "actions": [
           {
             "tag": "button",
             "text": {"tag": "plain_text", "content": "查看 PR / Review"},
             "url": "{pr_url}",
             "type": "primary"
           }
         ]
       }
     ]
   }
   ```

   The traceback section should be omitted if `traceback_preview` is empty.
   The `diff_preview` can be added as an additional section if provided.

   If `service_name` is not provided, use the legacy card format:
   ```json
   {
     "config": {"wide_screen_mode": true},
     "header": {
       "title": {"tag": "plain_text", "content": "🛠️ Bug 自动修复完成"},
       "template": "red"
     },
     "elements": [
       {
         "tag": "div",
         "text": {"tag": "lark_md", "content": "**Bug Summary**\n{summary}"}
       },
       {
         "tag": "action",
         "actions": [
           {
             "tag": "button",
             "text": {"tag": "plain_text", "content": "查看 PR"},
             "url": "{pr_url}",
             "type": "primary"
           }
         ]
       }
     ]
   }
   ```

4. **Send message**
   ```bash
   lark-cli im +messages-send --chat-id "{receive_id}" --data '{...interactive card payload...}'
   ```

   Prefer chat IDs that start with `oc_`.

## Output

- Log the API response
- If failed, write error to `.claude/triggers/notify_error.log`
