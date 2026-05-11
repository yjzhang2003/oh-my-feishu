---
title: 插件能力概览
eyebrow: Plugin
summary: 了解 oh-my-feishu plugin 如何把飞书 IM、文档、日历、表格、云盘等能力交给 Claude Code 使用。
order: 5
tags:
  - plugin
  - skills
  - lark-cli
  - feishu
---

## 能力模型

oh-my-feishu 不只是一个聊天入口，也包含一组 Claude Code 可以读取的 skills。这些 skills 约定了如何通过 lark-cli 操作飞书能力。

Claude Code 在处理飞书任务时，会根据用户意图选择对应 skill，再调用本地命令完成查询、创建、更新或通知。

## 已覆盖的飞书域

插件能力覆盖 IM 消息、文档、云盘、日历、表格、多维表格、任务、邮件、会议纪要、白板和审批等常见协作场景。

这些能力适合用在“帮我查找文档”“把结果发到群里”“生成会议纪要”“更新表格记录”等工作流里。

## 与主服务的关系

主服务负责飞书消息入口、会话绑定、卡片交互和后台自动化。插件 skills 负责让 Claude Code 理解具体飞书 API 和 lark-cli 使用方式。

两者组合后，用户可以在飞书里发起任务，Claude Code 在本地项目或飞书上下文中执行，再把结果回传到飞书。
