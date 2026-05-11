---
title: 目录会话
eyebrow: Directory sessions
summary: 把飞书聊天绑定到本地目录和 Claude session，支持持续的项目级协作。
order: 30
tags:
  - session
  - directory
  - claude
  - context
---

## 绑定工作目录

目录会话让一个飞书聊天对应到本机真实项目目录。Claude Code 后续执行任务时，会在这个目录中读取代码、运行验证命令并保留上下文。

绑定目录后，同一个聊天可以继续之前的 Claude session，不需要每次重新解释项目结构。

## 恢复历史会话

oh-my-feishu 会读取本机 Claude Code 的历史 session，允许用户选择已有会话继续，也可以创建新的目录会话。

当历史 session 不存在时，系统会用稳定 sessionId 重新创建会话，保持飞书 chatId 和本地工作上下文的关系。

## 移动端协作

目录会话的价值在于把项目级操作带到飞书里。用户可以在手机上发起排查、查看结果，再回到电脑继续同一个上下文。

对于高风险代码修改，建议先让 Claude 给出分析，再确认是否执行实际改动。
