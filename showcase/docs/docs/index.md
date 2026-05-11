---
title: 文档概览
description: 公开文档入口，说明 oh-my-feishu 的核心使用路径和文档维护规则。
---

# 文档概览

这组文档面向两类人：一类是使用者，想把 oh-my-feishu 装好、跑起来、接到飞书；另一类是贡献者，想了解公开文档放在哪里、怎么维护、哪些内容不应该发布到网站。

它不是 API reference，也不会逐项解释飞书开放平台的所有参数。文档重点放在真实使用路径、必要配置、常见失败原因和下一步该看什么。

## 推荐阅读路径

### 第一次安装

从 [安装与启动](/docs/install/) 开始，确认 Node.js、Claude Code 和全局 npm 包都可用。然后进入 [飞书配置](/docs/feishu/)，完成 QR 绑定和 lark-cli 授权，最后启动后台服务。

### 已经能收到飞书消息

继续阅读 [目录会话](/docs/sessions/)。这一步会把飞书聊天和本机项目目录关联起来，让 Claude Code 在正确的代码库里读取文件、运行命令和保留上下文。

### 需要后台自动化

阅读 [Web Monitor 自动化](/docs/web-monitor/)。这篇说明如何注册 traceback 地址、如何去重、什么时候需要用户确认，以及自动 PR 适合放在哪些场景。

## 常见入口

- [安装与启动](/docs/install/)：安装、启动和本地验证。
- [飞书配置](/docs/feishu/)：飞书应用、QR 绑定、lark-cli auth 和消息入口。
- [目录会话](/docs/sessions/)：目录绑定、历史会话和移动端协作。
- [Web Monitor 自动化](/docs/web-monitor/)：错误监控、确认式修复和自动 PR。
- [插件能力概览](/docs/plugin-capabilities/)：飞书插件 skills 能力地图。
- [部署与网站](/docs/deployment/)：showcase 网站和公开文档发布边界。

## 文档维护规则

公开文档放在 `showcase/docs/` 下，并由 VitePress 直接构建为静态页面。内容应该面向外部读者，避免包含内部周报、临时讨论、未公开 token、个人路径或私有部署信息。

根目录 `docs/` 是本地草稿区，用来存放周报、临时方案和内部记录。它不会被网站读取，也默认不应该进入 Git 跟踪。

## 下一步

如果你正在第一次配置，继续读 [安装与启动](/docs/install/)。如果你已经完成服务启动，但飞书里没有响应，直接跳到 [飞书配置](/docs/feishu/) 的排查部分。需要理解 Claude Code 能调用哪些飞书能力时，再读 [插件能力概览](/docs/plugin-capabilities/)。
