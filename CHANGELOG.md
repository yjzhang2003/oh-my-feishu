# Changelog

## [0.5.0] - 2026-04-30

### Added

- **Claude Code plugin marketplace**：仓库根目录提供 `.claude-plugin/marketplace.json`，支持通过 `claude plugin marketplace add` 添加并安装 `oh-my-feishu` 插件。
- **飞书菜单卡片**：重做 `/menu` 主菜单、目录输入、历史会话与详情页，使用卡片 2.0 的图标、分栏、表格和表单组件。
- **流式回复卡片**：新增等待提示，模型首个 thinking/text block 返回前不再显示空白正文。
- **Direct chat workspace 初始化**：服务启动时自动初始化仓库内 `workspace/` 的 Claude 插件配置，fresh clone 后无需提交运行时 `.claude` 数据。

### Changed

- **全局 CLI 入口统一为 `oh-my-feishu`**：`npm link` 后可在任意目录运行交互式配置，也可执行 `oh-my-feishu session new <directory>`。
- **飞书能力提示瘦身**：主 prompt 只保留飞书对话身份和按需读取 `lark-chat-guide` 的能力提示，减少常规问答 token 消耗。
- **流式卡片信息架构**：移除冗余副标题、状态 tag 和正文模式说明，降低卡片噪音。
- **品牌命名统一**：将旧的 `feishu-agent` 展示名收敛为 `oh-my-feishu`，PM2 服务仅保留 `oh-my-feishu`。

### Fixed

- 修复 streaming 完成后状态更新时机导致回复内容丢失的问题。
- 修复 marketplace 直接复制 fallback 在 ESM 运行时不可用的问题。
- 修复目录会话 CLI 未等待插件安装完成的问题。

## [0.4.0] - 2026-04-27

### Added

- **Service Registry**：JSON 文件存储的服务注册表，支持增删改查、启用/禁用、SHA-256 哈希去重 (`src/service/registry.ts`)
- **TracebackMonitor**：轮询已启用服务的日志端点，基于哈希检测新 traceback，自动触发修复 (`src/monitor/traceback-monitor.ts`)
- **TUI 服务管理**：Ink 交互界面集成到 `npm run cli`，支持添加/删除/启用/禁用服务 (`src/cli/components/ServiceManageScreen.tsx`)
- **飞书 /service 命令**：通过飞书消息管理服务注册表 (`src/feishu/websocket-connector.ts`)
- **Service Manager Skill**：Claude Code 技能，支持自然语言管理服务注册表 (`workspace/.claude/skills/service-manager/SKILL.md`)
- **Service-aware auto-repair**：自动修复技能支持多服务、多仓库，读取服务注册表获取目标仓库 (`workspace/.claude/skills/auto-repair/SKILL.md`)
- **Service-aware notify-feishu**：通知卡片支持服务名称、traceback 预览、PR 链接 (`workspace/.claude/skills/notify-feishu/SKILL.md`)
- **服务注册表单元测试**：19 个测试覆盖 registry 和 monitor (`src/service/registry.test.ts`, `src/monitor/traceback-monitor.test.ts`)
- **lark-approval / lark-attendance Skills**：从 git 历史恢复缺失的飞书技能

### Changed

- **lark-nav → lark-chat-guide**：技能重命名以反映其双重职责（聊天行为规则 + 技能导航），更新 Gateway prompt 引用
- **lark-chat-guide 对齐 master-template**：添加 metadata、认证规则、命令探索章节，补充 14 个缺失技能到可用列表
- **TriggerData 扩展**：新增 `service_name`、`traceback_url` 字段 (`src/trigger/trigger.ts`)
- **Invoker 扩展**：`loadServiceEnv()` 自动注入服务特定的环境变量 (`src/trigger/invoker.ts`)
- **Status 命令**：显示已注册服务数量 (`/status`)

### Removed

- `assets/claude/skills/` 目录：冗余的技能副本，唯一真实来源为 `workspace/.claude/skills/`
- `src/cli/service-command.ts`：未暴露入口的独立 CLI 脚本，功能已被 TUI 覆盖
- `workspace/.claude/skills/chat/`：已废弃的聊天 Skill

## [0.3.0] - 2026-04-24

### Added

- 消息去重和并发控制
- Gateway 捕获 Claude stdout 并发送回复
- 修复 stdin 警告

## [0.2.0] - 2026-04-23

### Added

- 初始 Claude Code 飞书集成
- WebSocket 长连接
- QR 扫码认证
- Auto-repair 基础功能
- Lark Skills 批量导入
