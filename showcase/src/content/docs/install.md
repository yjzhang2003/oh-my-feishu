---
title: 安装与启动
eyebrow: Getting started
summary: 从 npm 安装 oh-my-feishu，完成本地检查，并启动连接飞书的后台服务。
order: 10
tags:
  - install
  - cli
  - pm2
  - claude
---

## 准备环境

先确认本机可以运行 Claude Code 和 lark-cli。oh-my-feishu 会把这两个工具串起来：Claude Code 负责理解和执行任务，lark-cli 负责访问飞书能力。

推荐使用 Node.js 18 或更高版本。全局安装后，直接运行 `oh-my-feishu` 进入交互式配置流程。

## 常用命令

`npm install -g oh-my-feishu` 安装命令行工具。运行 `oh-my-feishu` 进入配置界面，运行 `oh-my-feishu status` 查看服务状态。

后台服务使用 PM2 管理。开发时可以使用 `npm run start:dev`，生产环境可以使用 `npm run start:prod`。

## 启动后台服务

完成飞书认证后，服务会通过 WebSocket 接收飞书消息和卡片交互事件。服务启动前会检查 Claude CLI、飞书配置和工作目录。

如果服务异常，先查看 `oh-my-feishu logs`，再确认飞书应用权限、appId/appSecret 和 lark-cli 配置是否一致。
