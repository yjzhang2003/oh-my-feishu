# Feishu Agent — 基于 Claude Code 的飞书自动化 Agent

## 项目简介

Feishu Agent 是一个具备环境感知 Tool Use 能力的自动化 Agent，能够：

1. **监控 Web 服务**：通过健康检查、日志监听发现异常
2. **智能分析**：利用 Claude LLM 分析 Traceback 根因
3. **自动修复**：生成代码补丁、运行测试、提交 PR
4. **飞书通知**：通过飞书（Lark）交互卡片通知开发者

## 架构设计

本项目采用 **Gateway + Claude Code Skills** 的混合架构：

- **Gateway（TypeScript / Hono）**：负责接收飞书消息、监控告警、发送通知
- **Claude Code Skills（标准 SKILL.md）**：核心 Agent 逻辑以标准 Skill 形式存在

```
飞书消息 / 监控告警 / 手动触发
         │
         ▼
┌─────────────────────────────┐
│  Gateway (Hono :8000)       │
│  /webhook  - 飞书事件回调    │
│  /monitor  - 外部监控告警    │
│  /trigger  - 手动触发(测试)  │
│  /health   - 健康检查        │
└──────────┬──────────────────┘
           │ 写入 trigger 文件
           ▼
┌─────────────────────────────┐
│  workspace/.claude/         │
│  ├── settings.json          │  ← Claude Code 项目配置
│  ├── triggers/latest.json   │  ← 触发上下文
│  └── skills/                │  ← 27 个 Lark Skills
│      ├── auto-repair/       │
│      ├── lark-im/           │
│      ├── lark-doc/          │
│      └── ...                │
└──────────┬──────────────────┘
           │ claude --skill xxx
           ▼
┌─────────────────────────────┐
│  Claude Code CLI            │
│  读取 SKILL.md → 执行协议    │
│  调用 lark-cli → 操作飞书    │
│  调用 gh → GitHub PR        │
└─────────────────────────────┘
```

## 技术栈

- **语言**: TypeScript + Node.js
- **CLI 框架**: Ink (React for CLI)
- **Web 框架**: Hono
- **飞书集成**: lark-cli + 自建 Webhook 服务器
- **GitHub**: gh CLI
- **Agent**: Claude Code CLI + Standard Skills

## 项目结构

```
feishu-agent/
├── src/
│   ├── cli/                 # 交互式 CLI (Ink)
│   │   ├── index.tsx        # 入口
│   │   ├── components/      # UI 组件
│   │   └── hooks/           # 状态检测
│   ├── gateway/             # 飞书网关
│   │   ├── server.ts        # Hono 服务器
│   │   └── routes/webhook.ts
│   ├── feishu/              # 飞书客户端
│   │   ├── client.ts        # 消息发送
│   │   ├── card.ts          # 卡片构建
│   │   └── lark-auth.ts     # lark-cli 认证
│   ├── monitor/             # 监控模块
│   │   ├── index.ts         # 入口
│   │   └── health-checker.ts
│   ├── trigger/             # 触发器
│   │   ├── trigger.ts       # 写入触发
│   │   └── invoker.ts       # 调用 Skill
│   └── config/              # 配置
│       └── env.ts           # 环境变量
├── workspace/
│   └── .claude/             # Claude Code 工作目录
│       ├── settings.json    # Claude Code 配置
│       ├── .env             # 飞书凭证 (可选)
│       ├── triggers/        # 触发文件
│       └── skills/          # 27 个 Skills
│           ├── auto-repair/
│           ├── lark-im/
│           ├── lark-doc/
│           └── ...
└── package.json
```

## 快速开始

### 前置要求

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/installation) 已安装
- [lark-cli](https://github.com/larksuite/cli) 已安装

### 安装

```bash
npm install
npm run build
```

### 配置

运行交互式配置 CLI：

```bash
npm run cli
```

CLI 会引导你完成：
1. **Claude Code** - 检测全局安装状态
2. **Feishu** - 使用 lark-cli 浏览器认证
3. **GitHub** - 检测 gh CLI 安装状态
4. **Gateway** - 启动网关服务

#### Claude Code 项目配置

如需配置 Claude Code（模型、API 等），编辑：

```
workspace/.claude/settings.json
```

示例配置：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_MODEL": "claude-sonnet-4-6"
  }
}
```

敏感的 API Key 建议放在全局配置 `~/.claude/settings.json` 中。

### 启动 Gateway

```bash
npm run gateway
```

Gateway 启动后：
- Health: http://localhost:8000/health
- Webhook: http://localhost:8000/webhook
- Monitor: http://localhost:8000/monitor

### 触发自动修复

**方式一：飞书命令**

在飞书群中 @机器人并发送：
```
/repair 修复登录页面的 500 错误
```

**方式二：监控告警**

```bash
curl -X POST http://localhost:8000/monitor \
  -H "Content-Type: application/json" \
  -d '{"context":"Health check failed","error_log":"Traceback..."}'
```

**方式三：手动触发**

```bash
curl -X POST http://localhost:8000/trigger \
  -H "Content-Type: application/json" \
  -d '{"context":"Manual repair request"}'
```

## 监控配置

Gateway 支持自动健康检查，通过环境变量配置：

```bash
# 在 .env 或环境变量中设置
MONITOR_TARGET_URL=http://your-service:port
MONITOR_INTERVAL_SEC=60    # 检查间隔（秒）
MONITOR_TIMEOUT_MS=5000    # 请求超时（毫秒）
```

当目标服务连续 2 次健康检查失败时，会自动触发 `auto-repair` Skill。

## Skills 列表

项目内置 27 个 Lark Skills，覆盖飞书各项能力：

| Skill | 描述 |
|-------|------|
| `lark-im` | 即时通讯：收发消息、管理群聊 |
| `lark-doc` | 文档操作：创建、编辑文档 |
| `lark-sheets` | 表格操作：读写电子表格 |
| `lark-calendar` | 日历管理：事件、日程 |
| `lark-drive` | 云盘操作：文件上传下载 |
| `lark-approval` | 审批流程：发起、查询审批 |
| `auto-repair` | 自动修复：分析错误、生成修复 |
| ... | 完整列表见 `workspace/.claude/skills/` |

## Webhook 签名验证

Gateway 自动验证飞书 Webhook 签名（如果配置了 `FEISHU_ENCRYPT_KEY`）：

```bash
# 可选：配置签名验证密钥
FEISHU_ENCRYPT_KEY=your_encrypt_key
FEISHU_VERIFICATION_TOKEN=your_token
```

## 安全设计

| 机制 | 说明 |
|------|------|
| Webhook 签名验证 | HMAC-SHA256 验证请求来源 |
| Monitor API Key | 保护 /monitor 端点 |
| lark-cli 认证 | 凭证存储在用户目录，不入代码库 |

## 扩展 Skill

在 `workspace/.claude/skills/` 下创建目录：

```
workspace/.claude/skills/my-skill/
└── SKILL.md
```

SKILL.md 格式：

```yaml
---
name: my-skill
description: 描述功能
---

# 协议

## Input
- 参数说明

## Procedure
1. 步骤一
2. 步骤二

## Output
- 期望输出
```

调用方式：
```bash
claude --skill my-skill
```

## 开发命令

```bash
# 开发
npm run dev          # 监听模式编译
npm run build        # 构建
npm run cli          # 启动配置 CLI
npm run gateway      # 启动 Gateway

# 类型检查
npx tsc --noEmit
```

## License

MIT
