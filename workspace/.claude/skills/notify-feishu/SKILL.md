---
name: notify-feishu
description: >
  Send an interactive Feishu (Lark) card message to notify developers
  about auto-repair results. Requires FEISHU_APP_ID and FEISHU_APP_SECRET env vars.
allowed-tools: Bash(curl *) Bash(cat *) Read
---

# Feishu Notification Protocol

## Input

- `receive_id`: Feishu user or chat open_id
- `pr_url`: GitHub pull request URL
- `summary`: Brief description of the bug and fix
- `diff_preview`: Optional short diff preview (truncated to 500 chars)

## Procedure

1. **Read env vars**
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`

2. **Get tenant_access_token**
   ```bash
   curl -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
     -H "Content-Type: application/json" \
     -d '{"app_id":"'$FEISHU_APP_ID'","app_secret":"'$FEISHU_APP_SECRET'"}'
   ```

3. **Build interactive card**
   Use this JSON structure:
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
   curl -X POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id" \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "receive_id": "{receive_id}",
       "msg_type": "interactive",
       "content": "{escaped_card_json}"
     }'
   ```

## Output

- Log the API response
- If failed, write error to `.claude/triggers/notify_error.log`
