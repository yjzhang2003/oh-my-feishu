---
name: notify-feishu
description: >
  Send an interactive Feishu (Lark) card message to notify developers
  about auto-repair results. Supports service-aware notifications with
  service name, traceback preview, and PR link.
  Requires FEISHU_APP_ID and FEISHU_APP_SECRET env vars.
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
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `NOTIFY_CHAT_ID` (used as fallback if `receive_id` not provided)

2. **Get tenant_access_token**
   ```bash
   curl -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
     -H "Content-Type: application/json" \
     -d '{"app_id":"'$FEISHU_APP_ID'","app_secret":"'$FEISHU_APP_SECRET'"}'
   ```

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
   curl -X POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id" \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "receive_id": "{receive_id}",
       "msg_type": "interactive",
       "content": "{escaped_card_json}"
     }'
   ```

   Use `receive_id_type=chat_id` when `receive_id` starts with `oc_`.
   Use `receive_id_type=open_id` when `receive_id` starts with `ou_`.

## Output

- Log the API response
- If failed, write error to `.claude/triggers/notify_error.log`
