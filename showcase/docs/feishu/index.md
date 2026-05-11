---
title: 飞书配置
description: 配置飞书应用、扫码认证和消息入口，让 Claude Code 可以在飞书中响应用户。
---

# 飞书配置

## 使用前准备

先确认已经安装全局 CLI，并且 Claude Code 可以运行：

```bash
oh-my-feishu help
claude --version
```

如果你要模拟新用户首次配置，需要确保 `~/.lark-cli` 不存在或已备份。只移动 `~/.oh-my-feishu` 不够，因为飞书 appId 和 appSecret 主要保存在 lark-cli 的配置目录中。

## 推荐流程

### 扫码绑定机器人

运行 `oh-my-feishu`，进入 `Feishu (Lark)`，选择 `QR Binding`。终端会显示二维码和备用链接，用飞书 App 扫码完成应用绑定。

扫码成功后，本机会写入 lark-cli 可识别的配置。后续服务启动时会读取这份配置来连接飞书。

### 执行 lark-cli 授权

回到 Feishu 配置页，选择 `lark-cli Auth`。这一步会运行 lark-cli 的登录授权流程，推荐授权常用 scopes，让 Claude Code 后续可以读取或更新飞书资源。

如果只完成 QR 绑定，没有完成 lark-cli 授权，机器人仍可能可以收消息，但涉及文档、日历、表格等用户身份能力时会受限。

### 启动服务并测试消息

进入 Service 配置页启动服务。然后在飞书中给机器人发送：

```text
/status
```

如果服务已连接，会返回当前状态。发送普通文本时，会进入 Claude Code 对话流程。

## 飞书入口

常用入口包括：

- `/menu`：打开功能菜单。
- `/status`：查看服务状态。
- `/help`：查看可用命令。
- 普通消息：进入 Claude Code 对话。
- 卡片按钮：触发目录绑定、Web Monitor 管理或确认式修复。

机器人需要被添加到目标群聊或私聊入口中。群聊中如果没有响应，先确认机器人是否在群里，以及应用权限是否已经发布生效。

## WebSocket 与事件订阅

oh-my-feishu 使用飞书 WebSocket 模式接收事件。这个模式不需要公网回调地址，适合本地运行的个人服务。

在飞书开放平台中，需要确保事件订阅方式支持长连接，并且机器人消息、卡片交互等事件已经启用。权限变更后通常需要重新发布应用。

## 常见问题

如果 QR 页面退出后重新显示二维码，说明旧版本后台轮询没有被取消。升级到 `0.7.1` 后，ESC 会取消轮询并清空二维码状态。

如果日志里出现 `ENOTFOUND open.feishu.com`，优先检查网络、代理和 DNS。WebSocket 已连接但菜单创建失败时，通常是访问开放平台接口失败。

如果 CLI 一直显示已配置，但你希望重新绑定，备份或删除 `~/.lark-cli` 后再运行 `oh-my-feishu`。

## 下一步

飞书消息能正常响应后，继续配置 [目录会话](/docs/sessions/)。如果你希望机器人自动监听服务错误并发起修复，再阅读 [Web Monitor 自动化](/docs/web-monitor/)。
