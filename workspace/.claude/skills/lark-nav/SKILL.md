---
name: lark-nav
description: "飞书技能导航。根据用户意图推荐合适的飞书技能。当用户需要与飞书交互但不确定用哪个技能时触发。"
---

# 飞书技能导航

## 可用技能列表

| 技能 | 用途 | 触发场景 |
|------|------|----------|
| `lark-im` | 即时通讯：发消息、搜索聊天、管理群聊 | 发送消息、查看聊天记录、下载聊天文件 |
| `lark-calendar` | 日历：创建/查询日程 | 查看日程、创建会议 |
| `lark-doc` | 文档：创建/编辑文档 | 写文档、查看文档 |
| `lark-sheets` | 表格：操作电子表格 | 处理表格数据 |
| `lark-drive` | 云盘：文件管理 | 上传/下载文件 |
| `lark-contact` | 通讯录：联系人管理 | 查找联系人、组织架构 |
| `lark-task` | 任务：任务管理 | 创建任务、查看任务列表 |
| `lark-wiki` | 知识库：文档管理 | 创建知识库页面 |

## 消息发送指南

### 发送文本消息
```bash
lark-cli im +messages-send --chat-id <chat_id> --text "消息内容"
```

### 发送 Markdown 消息
```bash
lark-cli im +messages-send --chat-id <chat_id> --text "**标题**\n- 列表项1\n- 列表项2" --type markdown
```

### 发送卡片消息
```bash
lark-cli im +messages-send --chat-id <chat_id> --data '{
  "type": "interactive",
  "card": {
    "header": {"title": {"content": "标题", "tag": "plain_text"}},
    "elements": [{"tag": "markdown", "content": "内容"}]
  }
}'
```

### 回复消息（支持 Thread）
```bash
lark-cli im +messages-reply --message-id <message_id> --text "回复内容"
```

## 使用流程

1. **分析用户意图** - 用户想做什么？
2. **选择合适技能** - 查看上表匹配
3. **查看技能详情** - 先读取对应技能的 SKILL.md
4. **执行操作** - 按照技能指引使用 lark-cli

## 注意事项

- 所有 lark 技能都依赖 `lark-cli`，确保已配置认证
- 发消息前确认 `chat_id` 正确
- 使用 `lark-cli <command> --help` 查看详细用法
