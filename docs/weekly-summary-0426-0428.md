# Feishu Agent 开发周期总结

> 开发周期：2026.04.26 — 2026.04.28
> 项目：Feishu Agent — 基于 Claude Code 的飞书自动化 Agent

---

## 一、核心产出

**交付成果：Gateway 卡片交互重构 + 目录会话系统 + 3 级菜单导航**

这三天的核心工作是将 Feishu Agent 从"被动消息处理"升级为"交互式卡片导航系统"，用户可以在飞书聊天中通过按钮点击完成会话创建、历史管理、目录切换等操作，无需输入任何命令。

主要成果：
- 重构 Gateway 支持卡片按钮交互（card.action.trigger 事件订阅与回调路由）
- 实现 3 级层次菜单：主菜单 → 新建会话/历史会话 → 会话详情，支持原地卡片更新
- 目录会话系统：用户指定项目目录后，Claude 在该目录中启动，可以访问项目代码和文件
- 目录输入表单卡片：使用飞书 Card JSON 2.0 的 form + input 组件，用户直接在卡片内输入路径
- Gateway 捕获 Claude stdout 并解析结构化结果，实现消息回传闭环
- 强制技能加载机制：通过 /lark-chat-guide 技能调用语法确保 Claude 每次都加载回复规则
- 会话历史持久化：基于 JSON 文件存储，重启后历史记录不丢失

---

## 二、量化指标

| 指标 | 数值 |
|------|------|
| 三天提交次数 | 40 次 |
| 新增功能特性 | 8 个（目录会话、3 级菜单、表单卡片、会话历史等） |
| Bug 修复 | 12 个（卡片结构、回调路由、CLI 参数等） |
| 新增文件 | 6 个（session-history-store、menu-cards、card-dispatcher 等） |
| 修改文件 | 15 个 |
| 版本迭代 | v0.3.0 → v0.4.0 |

**AI 协作统计：**
- Claude Code 代码生成占比：约 85%
- 人工调整比例：约 15%（飞书卡片结构调试、回调数据格式确认、交互细节）
- 调试轮次：卡片 200673 错误排查耗时最长，约 6 轮迭代才解决

---

## 三、过程复盘与沉淀

### 1. 每天主要搞定的事

**4月26日：Gateway 消息处理闭环**
- Gateway 捕获 Claude stdout 并通过 lark-cli 回传消息
- 修复 stdin 警告、消息去重、并发控制
- ACK 反应由 lark-cli 调用改为 SDK 直接调用，减少延迟
- 按聊天 ID 隔离会话，避免跨会话串消息
- 发布 v0.3.0

**4月27日：卡片交互系统与目录会话**
- 重构 Gateway 支持卡片按钮交互，订阅 card.action.trigger 事件
- 创建 CardDispatcher 回调路由系统，按 action 前缀分发到不同处理逻辑
- 实现 SessionAddFlow 多步交互流程：输入目录 → 列出已有会话 → 选择或新建
- 安装 marketplace 插件到目标目录，确保 Claude Code 技能可用
- 添加 P2P 进入事件处理：用户首次进入聊天自动发送导航卡片
- 创建机器人菜单（application:bot.menu:write 权限）
- 项目更名为 oh-my-feishu，README 改为中文
- 发布 v0.4.0

**4月28日：3 级菜单 + 表单卡片 + 消息回传修复**
- 实现 3 级层次菜单：主菜单 → 新建会话/历史会话 → 会话详情
- 所有导航通过卡片原地更新（callback response 返回新卡片），无需发送新消息
- 会话历史持久化到 data/session-history.json
- 修复 Claude 不使用 lark-cli 回复的问题：改用 /lark-chat-guide 技能调用语法强制加载
- 修复 chat_id 传递问题：lark-chat-guide 文档中明确通过 FEISHU_CHAT_ID 环境变量获取
- 实现目录输入表单卡片：使用飞书 Card JSON 2.0 的 form + input + form_submit 组件
- 排查卡片 200673 错误：最终定位为卡片结构不符合官方规范
- 移除 claude CLI 无效的 -C 参数

### 2. 卡住很久的情况及破局

**问题：飞书卡片 200673 错误（耗时最长）**
- 现象：目录会话的表单卡片点击后报 200673 "请求的卡片回调服务返回了错误的卡片"
- 尝试一：移除 config.update_multi，仍然报错
- 尝试二：移除 header，仍然报错
- 尝试三：简化 form 结构，去掉 column_set，按钮直接放 form 内，仍然报错
- 尝试四：改为 callback response 返回卡片而非直接发送，仍然报错
- 破局：用 /test-card 命令单独发送最小化表单卡片测试，逐步对比官方文档结构。最终发现：input 组件必须放在 form 容器内，form 内的按钮必须使用 action_type 而非 behaviors（回调按钮除外），且整体结构必须严格按官方示例的嵌套层级来。对照官方文档重写后解决。
- 核心教训：飞书卡片 2.0 的结构校验非常严格，任何偏差都会返回 200673 且服务端无日志，只能客户端看到错误。必须严格对照官方文档，不能凭推测写结构。

**问题：Claude 不通过 lark-cli 回复消息**
- 现象：用户发送消息后，Claude 的回复只出现在 stdout，飞书端收不到
- 原因一：prompt 只写了"请阅读 lark-chat-guide 技能"，但 Claude 不会主动加载技能
- 原因二：lark-cli 不知道发给哪个 chat_id，因为 chat_id 没有传给 Claude
- 破局：两步修复。第一，改用 /lark-chat-guide 技能调用语法（斜杠+技能名），Claude Code 会强制加载技能。第二，在 lark-chat-guide 技能文档中明确写明 chat_id 通过 FEISHU_CHAT_ID 环境变量获取，直接使用。

**问题：目录会话调用 claude CLI 报 "unknown option '-C'"**
- 现象：创建目录会话后发消息，报错 exit 1
- 原因：代码中用了 claude -C /path/to/dir，但 -C 不是 claude CLI 的有效参数
- 破局：移除 -C 参数，工作目录已通过 execa 的 cwd 选项设置，-C 是多余的

### 3. 可复用的东西

**飞书卡片 2.0 表单容器的正确结构**
- form 容器必须包含 input 和 button 子元素
- 提交按钮使用 action_type: form_submit，不需要 behaviors
- 回调按钮（如返回）使用 behaviors 数组配置 callback
- 按钮放在 column_set 的 column 中实现同行排列
- input 组件需要 label、default_value、width 等字段
- 不要在 form 容器的卡片上加 config.update_multi 或 header

**技能强制加载模式**
- 使用 /skill-name 语法可以在 Claude Code 中强制加载技能
- 技能文档中应明确环境变量的使用方式
- 技能文档中应明确 stdout 输出规范（结构化 JSON 结果）

**卡片回调路由设计**
- 按 action 前缀分发：menu:* → 菜单操作，service:* → 服务操作，session:* → 会话操作
- form_submit 回调的 tag 是 button，不是 form；表单数据在 action.form_value 中
- 卡片原地更新通过 callback response 返回 { card: { type: 'raw', data: cardObj } }

---

## 四、随手记

### 技术踩坑

1. 飞书卡片 200673 错误是客户端校验，服务端日志完全看不到，只能通过客户端弹窗发现
2. card.action.trigger 的回调数据格式和文档描述不完全一致，需要实际打印日志确认
3. 飞书 SDK 的 WSClient 会自动将事件数据扁平化，和原始 webhook 格式不同
4. --resume 参数指定 session ID 可以让 Claude 延续上下文，但 session 丢失后需要去掉 --resume 重试
5. claude CLI 没有 -C 参数，工作目录通过 cwd 环境变量或进程选项控制

### AI 用在了哪些环节

| 环节 | AI 贡献 |
|------|---------|
| 卡片结构生成 | 70% AI 生成，30% 人工对照文档修正 |
| 回调路由设计 | 90% AI 生成 |
| 会话管理逻辑 | 85% AI 生成 |
| 表单卡片调试 | 20% AI 排查，80% 人工逐步对比文档 |
| 错误处理 | 60% AI 生成，40% 人工补充 |
| 文档编写 | 90% AI 生成，10% 人工校对 |

### 调试方法论沉淀

飞书卡片结构调试的有效方法：
1. 先用 /test-card 命令单独发送最小化卡片，隔离是卡片结构问题还是回调处理问题
2. 逐步添加组件定位出错的部分
3. 严格对照官方文档示例的结构，不要自行推测
4. 注意 200673 错误是客户端校验，服务端看不到，需要从客户端排查

---

## 五、项目架构分层

| 层级 | 模块 | 职责 |
|------|------|------|
| 飞书交互层 | WebSocket Connector | 事件接收与分发 |
| | Message Router | 消息路由与命令处理 |
| | CardDispatcher | 卡片回调路由（menu/service/session） |
| | CardKit Manager | 卡片实体创建与更新 |
| 会话管理层 | SessionStore | 运行时会话状态（mode/flow/data） |
| | SessionHistoryStore | 会话历史持久化（JSON 文件） |
| | SessionAddFlow | 目录会话创建多步流程 |
| | SessionManager | Gateway IPC 会话管理 |
| 卡片构建层 | menu-cards | 3 级菜单卡片（Card JSON 2.0） |
| | card-builder | 通用卡片构建器（1.0 + 2.0） |
| | card | 基础卡片类型定义 |
| 命令层 | CommandRegistry | 命令注册表 |
| | MenuCommand | /menu 导航菜单 |
| | TestCardCommand | /test-card 调试 |
| | Repair/Status/Service/Help | 功能命令 |
| 触发器层 | Invoker | Claude CLI 调用与结果解析 |
| | Marketplace | 项目目录插件安装 |
| 技能层 | lark-chat-guide | 聊天回复规范与技能导航 |
| | lark-im/doc/sheets/calendar/drive/... | 27 个飞书集成技能 |
| | service-manager | 服务管理与监控 |

---

**总结**：这三天完成了 Feishu Agent 从"命令式交互"到"卡片式交互"的核心升级。最大收获是积累了飞书 Card JSON 2.0 表单容器的实战经验和调试方法论——官方文档是最终权威，200673 错误只能通过逐步对比官方结构来解决。目录会话系统让用户可以在指定项目中启动 Claude，配合技能强制加载和结构化结果解析，实现了完整的消息收发闭环。
