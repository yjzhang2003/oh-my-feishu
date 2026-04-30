# oh-my-feishu

> 在飞书上深度使用 Claude Code 的最佳方式

![Screenshots placeholder](docs/screenshots.png)

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-FF6F61?style=flat-square&logo=anthropic&logoColor=white)](https://docs.anthropic.com/en/docs/claude-code)
[![Feishu](https://img.shields.io/badge/Feishu-00A1E9?style=flat-square&logo=lark&logoColor=white)](https://www.feishu.cn/)

## 是什么

`oh-my-feishu` 将 Claude Code 深度集成到飞书。它把飞书变成 Claude Code 的强大界面——每个对话都是通往开发环境的桥梁。

## 特性

- **深度飞书集成** — 原生 WebSocket 连接，无需公网 URL
- **交互式卡片** — 基于按钮的导航和工作流
- **Gateway 架构** — 可扩展的消息路由和命令系统
- **服务发现** — 注册服务，让 Claude Code 发现你的基础设施
- **一键启动** — QR 码配置，60 秒上手

## 快速开始

当前版本暂不发布到 npm 包托管。安装方式是克隆仓库、本地构建，然后用 `npm link` 把 `oh-my-feishu` 安装成系统级命令。

```bash
# 克隆
git clone https://github.com/yjzhang2003/oh-my-feishu.git
cd oh-my-feishu

# 安装依赖并构建
npm install
npm run build

# 安装全局 CLI
npm link

# 配置飞书、Claude Code 和后台服务
oh-my-feishu
```

进入交互式 CLI 后，按界面完成 Claude Code、飞书扫码授权，并在 Service 页面启动后台服务。飞书扫码完成后即可在飞书里直接对话。

## CLI 命令

安装为全局命令后，可以在任意目录启动：

```bash
# 打开交互式设置
oh-my-feishu

# 在指定目录创建飞书会话
oh-my-feishu session new ./my-project

# 查看帮助
oh-my-feishu help
```

创建会话后，oh-my-feishu 会自动：
1. 将飞书能力插件安装到 `./my-project/.claude/settings.json`
2. 在该目录下启动 Claude Code 子进程
3. 通过 Gateway 将飞书消息转发给 Claude Code

这样你可以在任意 Claude Code 项目中，通过飞书与它对话。

## Direct Chat Workspace

没有绑定目录的普通飞书对话会运行在仓库内的 `workspace/` 目录。服务启动时会自动创建并初始化 `workspace/.claude/settings.json`，把 `oh-my-feishu` 插件安装进去，因此 fresh clone 后不需要手动提交或复制 `workspace/.claude`。

如果需要给 direct chat 提供飞书凭证，可参考 `workspace/.claude/.env.example` 创建本地 `workspace/.claude/.env`。该目录属于运行时数据，不会提交到 git。

## Claude Marketplace

本仓库本身就是 Claude Code plugin marketplace。其他项目可以添加这个 marketplace 后安装插件：

```bash
claude plugin marketplace add https://github.com/yjzhang2003/oh-my-feishu
claude plugin install oh-my-feishu@oh-my-feishu-marketplace --scope project
```

本地开发时也可以用仓库路径：

```bash
claude plugin marketplace add /path/to/oh-my-feishu --scope project
claude plugin install oh-my-feishu@oh-my-feishu-marketplace --scope project
```

## 工作原理

每条飞书消息都经过 Gateway：

```
你 → 飞书 → Gateway → Claude Code → Gateway → 飞书 → 你
```

Gateway 处理：
- 消息路由（文本、卡片、命令）
- 会话状态管理
- 交互式卡片回调
- 服务发现与注册

## 开发

架构和开发指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT
