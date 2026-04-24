# Feishu Agent — 基于 Agent 的服务自动化修复系统

## 项目简介

Feishu Agent 是一个具备环境感知 Tool Use 能力的自动化 Agent，能够：

1. **监控 Web 服务**：通过健康检查、日志监听、GitHub Issue 轮询发现异常
2. **智能分析**：利用 Claude LLM 分析 Traceback 根因
3. **自动修复**：生成代码补丁、运行测试、提交 PR
4. **飞书通知**：通过飞书（Lark）交互卡片通知开发者

## 架构设计（混合架构）

本项目采用 **Gateway + Claude Code Skills** 的混合架构：

- **Gateway（Python / FastAPI）**：负责接收飞书消息、监控告警、发送通知。轻量级，无重逻辑。
- **Claude Code Skills（标准 SKILL.md）**：核心 Agent 逻辑（自动修复、日志分析、安全检查、飞书通知）以标准 Skill 形式存在，由 Claude Code CLI 执行。

```
Feishu Message / Monitor Alert
         |
         v
+---------------------------+
|  Gateway (FastAPI)        |
|  - webhook_server.py      |
|  - bot.py                 |
|  - trigger.py             |
+-----------+---------------+
            | 写入 trigger
            v
+---------------------------+
|  Claude Code Skills       |
|  - auto-repair            |
|  - analyze-log            |
|  - safety-check           |
|  - notify-feishu          |
+-----------+---------------+
            | 执行修复 / 通知
            v
      GitHub PR / Feishu Card
```

### 为什么选择混合架构？

- **Gateway 专注 I/O**：接收 webhook、调用外部 API，保持简单稳定
- **Skills 专注智能**：利用 Claude Code 的原生能力（工具调用、代码编辑、测试运行）
- **可扩展**：新增能力只需添加 Skill，无需修改 Gateway
- **标准兼容**：Skills 遵循 Claude Code 标准，可复用社区生态

## 技术栈

- **LLM / Agent**: Claude Code CLI + Standard Skills (`SKILL.md`)
- **飞书集成**: `lark-oapi` SDK + 自建 Webhook 服务器
- **GitHub**: REST API 自动化 PR
- **测试**: pytest + pytest-cov（覆盖率 86%）

## 项目结构

```
feishu-agent/
├── .claude/
│   ├── skills/             # 标准 Claude Code Skills
│   │   ├── auto-repair/    # 7 步自动修复流水线
│   │   ├── analyze-log/    # 日志分析与根因定位
│   │   ├── safety-check/   # 安全审查（Path/Diff/Secret/Test Guard）
│   │   └── notify-feishu/  # 飞书交互卡片通知
│   └── triggers/           # Gateway 与 Skills 的触发文件
├── gateway/                # 飞书网关（Python FastAPI）
│   ├── bot.py              # 轻量级消息发送器 + 简单命令分发
│   ├── card_builder.py     # 交互卡片构建
│   ├── trigger.py          # 触发器写入 + Skill 调用桥接
│   └── webhook_server.py   # FastAPI Webhook 接收
├── agent/                  # 遗留：Claude Agent SDK 核心（参考用）
│   ├── core.py             # 对话循环 + 工具调用
│   ├── tools/              # 内置工具
│   └── prompts/            # 系统提示词
├── skills/                 # 遗留：Python Skill 注册表（参考用）
│   ├── registry.py
│   └── _builtins/
├── hooks/                  # 生命周期 Hook 系统
│   ├── manager.py
│   └── built_in.py
├── monitor/                # 监控实现
│   ├── log_watcher.py
│   ├── health_checker.py
│   └── issue_poller.py
├── repair/                 # 遗留：自动修复流程（参考用）
│   ├── flow.py
│   ├── safety.py
│   └── github_client.py
├── demo/                   # 演示服务（带故意 Bug 的 Flask 应用）
│   └── web_service/
└── tests/                  # 测试套件
    ├── unit/
    └── integration/
```

## 快速开始

### 前置要求

- Python 3.10+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/installation) 已安装并登录

### 1. 安装依赖

```bash
pip install -e ".[dev]"
```

### 2. 一键配置（推荐）

运行交互式安装脚本，自动检查 Claude CLI、部署 Skills、生成 `.env`：

```bash
python scripts/install.py
```

或从 npm 入口调用：

```bash
npm run setup
```

脚本会引导你完成：
1. 检查 Claude Code CLI 是否已安装
2. 部署 `.claude/skills/` 和 `.claude/settings.json`
3. 交互式填写飞书 / GitHub / Agent 环境变量，生成 `.env`
4. 检查 ECC (oh-my-claudecode) 插件
5. 运行单元测试验证

### 3. 手动配置（备选）

如果你不想用安装脚本，可以手动配置：

#### Claude Code 配置

Claude Code CLI 优先读取项目级 `.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_MODEL": "claude-sonnet-4-6"
  }
}
```

敏感的 API Key（`ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`）建议放在全局配置 `~/.claude/settings.json` 中，避免泄露。

#### 项目环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
# 飞书
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# Monitor webhook 保护（生产环境建议启用）
MONITOR_API_KEY=your_random_api_key

# GitHub
GITHUB_TOKEN=ghp_your_token
GITHUB_REPO_OWNER=your_org
GITHUB_REPO_NAME=your_repo

# Agent
REPO_ROOT=/absolute/path/to/repo
```

### 4. 运行测试

```bash
pytest tests/ -v --cov=agent --cov=gateway --cov=repair --cov=skills --cov=hooks --cov=monitor
```

当前覆盖率：**86%**（87 个测试）

### 5. 启动 Gateway

```bash
# 开发模式
fastapi dev gateway/webhook_server.py

# 或生产模式
uvicorn gateway.webhook_server:app --host 0.0.0.0 --port 8000
```

### 6. 触发自动修复

**方式一：飞书命令**

在飞书群中 @机器人并发送：
```
/repair 修复 demo/web_service/app.py 中的 ZeroDivisionError
```

**方式二：监控告警**

```bash
curl -X POST http://localhost:8000/monitor \
  -H "Content-Type: application/json" \
  -d '{"context":"Health check failed","error_log":"Traceback (most recent call last): ..."}'
```

**方式三：本地直接调用 Skill**

```bash
# 写入触发器
echo '{"context":"fix bug","error_log":"","source":"manual"}' > .claude/triggers/latest.json

# 执行 Skill
claude --skill auto-repair
```

### 7. 启动演示服务（可选）

```bash
python demo/web_service/app.py
```

触发 Bug：
```bash
curl "http://localhost:5000/divide?a=10&b=0"    # ZeroDivisionError
curl "http://localhost:5000/user?id=alice"        # KeyError
curl "http://localhost:5000/concat?prefix=hi_&num=1"  # TypeError
```

## 安全设计

| 层级 | 机制 | 说明 |
|------|------|------|
| PathGuard | `realpath` 必须在 `REPO_ROOT` 内 | 防止 AI 修改系统文件 |
| DiffGuard | 限制最大文件数（10）和行数（500） | 防止大规模破坏性变更 |
| TestGuard | 修复后强制跑测试 | 确保修复不引入回归 |
| SecretGuard | 禁止 diff 中出现 api_key / password / token | 防止密钥泄露 |
| HITL | 超限时停止并请求人工确认 | 关键操作人工把关 |

## Skill / Hook 扩展

### 添加新 Claude Code Skill

在 `.claude/skills/` 下创建目录：

```
.claude/skills/my_skill/
└── SKILL.md       # 标准 Skill 文档（YAML frontmatter + Markdown 协议）
```

Skill 文档格式示例：
```yaml
---
name: my-skill
description: 描述这个 Skill 的功能
allowed-tools: Read Edit Bash(pytest *)
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

然后即可通过以下方式调用：
```bash
claude --skill my-skill
```

### 添加新 Hook

```python
from hooks.manager import HookManager

def my_hook(**kwargs):
    print("Before repair:", kwargs)

manager = HookManager()
manager.register("before_repair", my_hook)
```

支持的事件：`before_repair`, `after_repair`, `before_tool_call`, `after_tool_call`, `on_error`

## 交付物

1. 代码仓库：包含 Agent 逻辑代码和自动修复记录
2. 测试覆盖：68 个测试，86% 覆盖率
3. 标准 Skills：4 个可复用的 Claude Code Skills
4. 演示视频：展示从报错到飞书通知的全过程（需录制）

## 评判标准对应

| 标准 | 实现 |
|------|------|
| 工具链整合 | Claude Code CLI + lark-oapi + GitHub API + pytest |
| 安全性 | PathGuard + DiffGuard + TestGuard + SecretGuard + HITL |
| 可扩展性 | 标准 Skill 系统 + Hook 管理器 |
| 可测试性 | 86% 覆盖率 |
