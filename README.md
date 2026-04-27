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

```bash
# 克隆
git clone https://github.com/yjzhang2003/oh-my-feishu.git
cd oh-my-feishu

# 安装
npm install
npm run build

# 配置（交互式 CLI）
npm run cli

# 启动
npm start
```

用飞书扫码，即开即用。

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
