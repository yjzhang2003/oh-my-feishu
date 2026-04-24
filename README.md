# Feishu Agent — 基于 Agent 的服务自动化修复系统

## 项目简介

Feishu Agent 是一个具备环境感知 Tool Use 能力的自动化 Agent，能够：

1. **监控 Web 服务**：通过健康检查、日志监听、GitHub Issue 轮询发现异常
2. **智能分析**：利用 Claude LLM 分析 Traceback 根因
3. **自动修复**：生成代码补丁、运行测试、提交 PR
4. **飞书通知**：通过飞书（Lark）交互卡片通知开发者

## 技术栈

- **LLM**: Claude via Anthropic Agent SDK
- **飞书集成**: `lark-oapi` SDK + 自建 Webhook 服务器
- **GitHub**: REST API 自动化 PR
- **测试**: pytest + pytest-cov（覆盖率 85%）

## 项目结构

```
feishu-agent/
├── agent/                  # Claude Agent SDK 核心
│   ├── core.py             # 对话循环 + 工具调用
│   ├── tools/              # 内置工具（读日志、读代码、跑测试、Git 操作、发飞书卡片）
│   └── prompts/            # 系统提示词（含安全规则）
├── gateway/                # 飞书网关
│   ├── bot.py              # 事件分发器（@mention、slash 命令）
│   ├── card_builder.py     # 交互卡片构建
│   └── webhook_server.py   # FastAPI Webhook 接收
├── skills/                 # 可扩展 Skill 系统
│   ├── registry.py         # Skill 动态加载器
│   └── _builtins/          # 内置 Skill（service_monitor, auto_repair）
├── hooks/                  # 生命周期 Hook 系统
│   ├── manager.py          # Hook 注册与发射
│   └── built_in.py         # 默认 Hook（日志、监控）
├── monitor/                # 监控实现
│   ├── log_watcher.py      # 日志监听
│   ├── health_checker.py   # HTTP 健康探测
│   └── issue_poller.py     # GitHub Issue 轮询
├── repair/                 # 自动修复流程
│   ├── flow.py             # 7 步修复流水线
│   ├── safety.py           # 安全闸门（PathGuard + DiffGuard）
│   └── github_client.py    # GitHub PR 客户端
├── demo/                   # 演示服务（带故意 Bug 的 Flask 应用）
│   └── web_service/        # 3 个 Bug：ZeroDivisionError, KeyError, TypeError
└── tests/                  # 测试套件
    ├── unit/               # 单元测试
    └── integration/        # 集成测试
```

## 快速开始

### 1. 安装依赖

```bash
pip install -e ".[dev]"
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
# Anthropic
ANTHROPIC_API_KEY=your_key
ANTHROPIC_BASE_URL=https://api.anthropic.com  # 可选，中转代理地址
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022    # 可选，模型名称

# 飞书
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# GitHub
GITHUB_TOKEN=ghp_your_token
GITHUB_REPO_OWNER=your_org
GITHUB_REPO_NAME=your_repo

# Agent
REPO_ROOT=/absolute/path/to/repo
```

### 3. 运行测试

```bash
pytest tests/ -v --cov=agent --cov=gateway --cov=repair --cov=skills --cov=hooks --cov=monitor
```

当前覆盖率：**85%**

### 4. 启动演示服务

```bash
python demo/web_service/app.py
```

触发 Bug：
```bash
curl "http://localhost:5000/divide?a=10&b=0"    # ZeroDivisionError
curl "http://localhost:5000/user?id=alice"        # KeyError
curl "http://localhost:5000/concat?prefix=hi_&num=1"  # TypeError
```

### 5. 启动飞书 Bot

```bash
python -c "from gateway.bot import FeishuBot; bot = FeishuBot(); print('Bot ready')"
```

## 安全设计

| 层级 | 机制 | 说明 |
|------|------|------|
| PathGuard | `realpath` 必须在 `REPO_ROOT` 内 | 防止 AI 修改系统文件 |
| DiffGuard | 限制最大文件数（10）和行数（500） | 防止大规模破坏性变更 |
| TestGuard | 修复后强制跑测试 | 确保修复不引入回归 |
| HITL | 超限时停止并请求人工确认 | 关键操作人工把关 |

## Skill / Hook 扩展

### 添加新 Skill

在 `skills/` 下创建目录：

```
skills/my_skill/
├── skill.yaml       # name, entrypoint, config
└── my_skill.py      # class SkillImpl(Skill): ...
```

重启 Agent 即可自动加载。

### 添加新 Hook

```python
from hooks.manager import HookManager

def my_hook(**kwargs):
    print("Before repair:", kwargs)

manager = HookManager()
manager.register("before_repair", my_hook)
```

## 交付物

1. ✅ 代码仓库：包含 Agent 逻辑代码和自动修复记录
2. ✅ 测试覆盖：62 个测试，85% 覆盖率
3. 🎬 演示视频：展示从报错到飞书通知的全过程（需录制）

## 评判标准对应

| 标准 | 实现 |
|------|------|
| 工具链整合 | Claude Agent SDK + lark-oapi + GitHub API + pytest |
| 安全性 | PathGuard + DiffGuard + TestGuard + HITL |
| 可扩展性 | Skill 注册表 + Hook 管理器 |
| 可测试性 | 80%+ 覆盖率 |
