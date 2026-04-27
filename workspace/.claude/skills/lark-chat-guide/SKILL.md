---
name: lark-chat-guide
version: 1.0.0
description: "飞书聊天助手行为规范与技能导航。定义回复规则（stdout 不可见，必须走 lark-cli）以及推荐合适的飞书技能。"
metadata:
  category: "productivity"
  requires:
    bins: ["lark-cli"]
---

# 飞书技能导航

## 可用技能列表

| 技能 | 用途 | 触发场景 |
|------|------|----------|
| `lark-im` | 即时通讯：发消息、搜索聊天、管理群聊 | 发送消息、查看聊天记录、下载聊天文件 |
| `lark-calendar` | 日历：创建/查询日程 | 查看日程、创建会议 |
| `lark-doc` | 文档：创建/编辑文档 | 写文档、查看文档 |
| `lark-sheets` | 表格：操作电子表格 | 处理表格数据 |
| `lark-base` | 多维表格：数据管理、仪表盘、表单 | 创建多维表格、管理数据、搭建仪表盘 |
| `lark-drive` | 云盘：文件管理 | 上传/下载文件、创建文件夹 |
| `lark-contact` | 通讯录：联系人管理 | 查找联系人、组织架构 |
| `lark-task` | 任务：任务管理 | 创建任务、查看任务列表 |
| `lark-wiki` | 知识库：文档管理 | 创建知识库页面、管理空间 |
| `lark-mail` | 邮件：收发邮件、签名、草稿 | 发送邮件、查看收件箱、管理签名 |
| `lark-vc` | 视频会议：会议管理、录制、纪要 | 预约会议、获取录制文件、会议纪要 |
| `lark-whiteboard` | 白板：协作白板、图表绘制 | 创建白板、绘制流程图/架构图 |
| `lark-slides` | 幻灯片：演示文稿 | 创建幻灯片、批量替换内容 |
| `lark-minutes` | 妙记：语音转文字、会议记录 | 搜索妙记、下载转录内容 |
| `lark-okr` | OKR：目标管理、周期、进度 | 查看 OKR、更新进度、查看周期 |
| `lark-approval` | 审批：审批实例、审批任务 | 创建审批、查询审批进度 |
| `lark-attendance` | 考勤：打卡记录、排班 | 查询考勤打卡记录 |
| `lark-event` | 事件订阅：订阅飞书事件 | 配置事件订阅、接收回调 |
| `lark-workflow-meeting-summary` | 工作流：会议总结 | 自动生成会议纪要 |
| `lark-workflow-standup-report` | 工作流：日报 | 自动生成日报/周报 |
| `lark-openapi-explorer` | OpenAPI 探索：发现 API 能力 | 探索不熟悉的 API |
| `lark-skill-maker` | 技能制作：自定义 Lark Skill | 创建或修改 Lark Skill |

## 认证与共享规则

**CRITICAL — 开始前 MUST 先用 Read 工具读取 [`../lark-shared/SKILL.md`](../lark-shared/SKILL.md)，其中包含认证、权限处理**

所有 lark 技能都依赖 `lark-cli`，确保已配置认证。

## 命令探索

```bash
lark-cli <service> <resource> <method> [flags]  # 调用原生 API
lark-cli schema <service>.<resource>.<method>   # 调用原生 API 前必须先查看参数结构
lark-cli <service> --help                       # 列出可用资源和命令
lark-cli --help                                 # 探索更多能力
lark-cli <service> +<shortcut> [flags]          # 使用 Shortcut 快速操作
```

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

1. **分析用户意图** — 用户想做什么？
2. **选择合适技能** — 查看上表匹配
3. **查看技能详情** — 先读取对应技能的 SKILL.md
4. **执行操作** — 按照技能指引使用 lark-cli

## 回复规则

你是飞书聊天助手，**必须通过 lark 技能（lark-cli）回复用户**，不能将回复内容输出到 stdout。

- stdout 不会展示给用户 — 仅被 Gateway 作为日志记录
- 所有用户可见的回复都必须通过 `lark-cli im +messages-send` 发送
- 你可以发送多条消息（进度、链接、总结等），不受限制
- 不要在 stdout 中重复你已经通过 lark-cli 发送的内容

## 注意事项

- 所有 lark 技能都依赖 `lark-cli`，确保已配置认证
- 发消息前确认 `chat_id` 正确
- 使用 `lark-cli <command> --help` 查看详细用法
- 使用 Shortcut（`+<verb>`）优先于原生 API，Shortcut 是官方推荐的高级封装
