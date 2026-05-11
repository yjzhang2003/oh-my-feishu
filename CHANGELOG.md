# Changelog

## [0.7.1] - 2026-05-11

### Changed

- **配置菜单更紧凑**：Feishu 与 Service 配置页改为类似主界面的短状态标记，不再显示过长说明文本。
- **QR 码终端显示缩小**：二维码 ASCII 渲染改为半高字符，减少终端占用空间。

### Fixed

- 修复 QR 页面退出后后台轮询继续更新状态，导致二维码残留或重新出现的问题。
- 修复从 QR 流程退出回主 setup 后按 `q` 可能无法退出的问题。

## [0.7.0] - 2026-05-10

### Added

- **内置 lark-cli 与 PM2**：npm 包随安装提供 `@larksuite/cli` 和 PM2，减少用户手动安装步骤。
- **lark-cli 授权入口**：CLI 配置页新增 `Login lark-cli Auth`，引导用户完成 QR code 绑定后再执行 lark-cli 授权。
- **工具路径解析测试**：新增 package-managed tool resolver，覆盖 npm hoisting、Windows `.cmd` 和 PATH 注入场景。

### Changed

- **服务管理使用包内 PM2**：Start/Stop/Restart/Status 优先调用当前 npm 包解析到的 PM2。
- **Claude 子进程继承包内工具路径**：触发器、marketplace、Claude process manager 统一注入 package `.bin`，让 workspace 侧也能找到 lark-cli。
- **安装文档简化**：README 改为说明 oh-my-feishu 自带 lark-cli/PM2，并明确先飞书 QR 绑定、再 lark-cli 授权、最后启动服务的顺序。

### Fixed

- 修复 npm 包未发布 `ecosystem.config.cjs` 导致 PM2 service 模式找不到配置的问题。
- 修复 PM2 配置在全局 npm 安装场景指向 `src/start.ts`，实际包内只有 `dist/start.js` 的问题。
- 修复 npm 依赖 hoisting 后 `pm2` 与 `lark-cli` 二进制路径解析失败的问题。
- 修复发布包中残留 `tsx` 源码启动假设的问题，npm `start` 现在使用编译后的 `dist/start.js`。
- 修复部分 Web Monitor 触发路径硬编码到本地开发目录的问题。

## [0.6.5] - 2026-05-05

### Added

- **两阶段确认流程**：Web Monitor 自动修复前新增确认卡片，用户可点击"开始分析"才执行修复，支持重复点击保护。
- **清除 Hash 按钮**：Web Monitor 详情页支持手动清除 traceback 哈希，允许用户主动重新触发相同错误的修复。
- **结构化 Claude 结果存储**：`lastClaudeRunResult` 替代 `lastClaudeRunSummary`，以结构化 JSON 存储 rootCause、changes、verification、pr 等字段。

### Changed

- **npm 包开箱可用**：全局安装时 workspace 目录默认使用 `~/.oh-my-feishu`，服务启动时自动创建所需目录。
- **Web Monitor 详情卡片优化**：使用 interactive_container 替代 table 展示服务信息，结构化展示 Claude Code 介入结果。
- **Traceback 预览截断方向**：长日志从头部截取（保留最早的异常堆栈），而非尾部。

### Fixed

- 修复 npm 全局安装后 workspace 目录指向 npm 包目录导致无法写入的问题。
- 修复 Claude Code 结果文件读取路径错误，现在从 workspace 触发器目录读取。
- 修复重复点击"确认修复"或"开始分析"可能导致的并发问题。

## [0.6.0] - 2026-05-03

### Added

- **自动化服务菜单**：将原 Gateway 入口调整为面向用户的“自动化技能”，在飞书菜单中展示可扩展的自动化服务。
- **Web 服务监控卡片管理**：Web 服务监控支持服务列表、详情页、新建监控、删除监控，以及“以此目录新建会话”。
- **本地服务仓库工作区**：注册 Web 监控服务时会浅克隆 GitHub 仓库到 `workspace/services/<serviceName>`，后台任务在服务目录中执行。
- **Web Monitor CLI**：新增 `oh-my-feishu web-monitor` 命令，支持 list、add、get、update、remove 等服务管理操作。
- **Web Monitor workspace skills**：新增面向 workspace Claude Code 的 Web Monitor 服务管理和自动修复技能，主 agent 可以通过技能增删改查监控服务。
- **自动 PR 配置**：Web Monitor 服务支持配置是否自动创建 PR、目标分支、Draft/Ready 模式和修复分支前缀。

### Changed

- **Web Monitor 修复流程模块化**：服务监控任务改为 Gateway feature 流程，触发后静默调用 Claude Code，只返回最终处理结果。
- **Web Monitor 结果卡片化**：自动修复完成后优先以飞书卡片返回结果，不再只发送纯文本。
- **服务详情卡片重构**：Web 服务监控详情页改为纵向信息块，统一展示仓库、本地目录、Traceback URL、通知会话、PR 设置、最近日志和最近一次 Claude Code 介入。
- **技能边界调整**：Web Monitor 专用技能移动到 workspace，只服务于 oh-my-feishu 主工作区，不再和用户项目技能混在一起。
- **安装与运行路径整理**：workspace 路径从包根目录解析，fresh clone 后自动创建运行所需目录，仓库不再保留运行时 `.claude` 数据。

### Fixed

- 修复新建监控卡片在飞书中不更新的问题，对齐 Card JSON 2.0 表单结构。
- 修复 Web Monitor 注册回调超时风险，耗时仓库克隆改为后台执行，回调先返回创建中提示。
- 修复测试后服务注册表和本地服务仓库可能残留脏数据的问题。
- 修复 Web Monitor 详情页日志预览显示最老内容的问题，累积日志现在展示最近片段。
- 移除状态检查中不必要的 GitHub 检测，避免误导用户。

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
