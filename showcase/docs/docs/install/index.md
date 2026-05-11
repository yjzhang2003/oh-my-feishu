---
title: 安装与启动
description: 从 npm 安装 oh-my-feishu，完成本地检查，并启动连接飞书的后台服务。
---

# 安装与启动

## 使用前准备

本机需要 Node.js 18 或更高版本。推荐先确认下面两个命令可用：

```bash
node --version
npm --version
```

Claude Code 需要提前安装并登录，因为 oh-my-feishu 只是把飞书消息转交给本机 Claude Code，并不会替你配置 Claude 账号。

```bash
claude --version
```

从 `0.7.0` 开始，oh-my-feishu 会随包提供 PM2 和 `@larksuite/cli`，普通用户不需要再手动全局安装它们。

## 推荐流程

### 安装全局 CLI

运行：

```bash
npm install -g oh-my-feishu
```

安装后确认入口存在：

```bash
oh-my-feishu help
```

如果命令不存在，先检查 `npm root -g` 和全局 npm bin 是否在 `PATH` 中。

### 进入交互式配置

运行：

```bash
oh-my-feishu
```

主界面会显示 Claude Code、Feishu 和 Service 三个状态。先进入 Feishu 配置，完成 QR 绑定，再执行 `lark-cli Auth`。这两个步骤分别解决“创建/绑定飞书应用”和“授权常用飞书能力”。

### 启动后台服务

飞书配置完成后进入 Service 配置，选择 `Start Service`。服务会由包内 PM2 启动，入口指向已编译的 `dist/start.js`，日志写入 `~/.oh-my-feishu/logs/`。

## 常用验证命令

查看 PM2 状态：

```bash
pm2 status
```

查看最近日志：

```bash
pm2 logs oh-my-feishu --lines 50
```

确认全局包版本：

```bash
npm list -g oh-my-feishu --depth=0
```

如果你怀疑全局安装还指向本地源码，可以检查 `npm list -g` 是否显示 symlink。真实 npm 安装应该显示普通版本号，而不是指向项目目录。

## 常见问题

服务启动失败时，先看 `~/.oh-my-feishu/logs/pm2-error.log`。常见原因包括 Claude Code 未登录、飞书配置不存在、网络无法访问飞书开放平台，或者之前残留了旧 PM2 进程。

如果 CLI 显示 Feishu 已配置，但你希望重新走首次绑定流程，需要同时清理或备份 `~/.lark-cli`。`~/.oh-my-feishu` 保存 workspace 和日志，`~/.lark-cli` 保存飞书 app 配置和 lark-cli 登录态。

## 下一步

完成安装后，继续阅读 [飞书配置](/docs/feishu/)，确认机器人入口、事件订阅、群聊添加和权限发布都正确。随后阅读 [目录会话](/docs/sessions/)，把飞书聊天绑定到本机项目目录。
