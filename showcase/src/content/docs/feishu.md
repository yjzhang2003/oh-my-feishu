---
title: 飞书配置
eyebrow: Feishu setup
summary: 配置飞书应用、扫码认证和消息入口，让 Claude Code 可以在飞书中响应用户。
order: 20
tags:
  - feishu
  - lark
  - auth
  - websocket
---

## 创建飞书应用

在飞书开放平台创建企业自建应用，准备 appId 和 appSecret。oh-my-feishu 会把这些配置写成 lark-cli 可以识别的格式。

消息能力需要开启机器人、事件订阅和卡片交互。使用 WebSocket 模式时，不需要公网回调地址即可接收事件。

## 扫码与授权

首次运行 CLI 时，会展示二维码完成飞书授权。授权成功后，本地会保存访问飞书 API 所需的配置。

如果扫码成功但消息没有响应，优先检查应用是否被添加到目标群聊，以及事件权限是否已经发布生效。

## 飞书入口

在飞书中发送 `/menu` 可以打开功能菜单，发送 `/status` 可以查看服务状态，普通消息会进入 Claude Code 对话。

卡片按钮由 CardDispatcher 统一处理，可以触发目录绑定、Web Monitor 服务管理和确认式修复流程。
