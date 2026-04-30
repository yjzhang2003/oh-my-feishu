# oh-my-feishu

> The best way to use Claude Code on Feishu.

把飞书变成 Claude Code 的团队入口：扫码完成配置，在飞书里直接对话、切换项目目录、触发后台 Gateway 任务，并让 Claude Code 在需要时调用飞书能力。

<p>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <a href="https://docs.anthropic.com/en/docs/claude-code"><img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-ready-FF6F61?style=flat-square"></a>
  <a href="https://www.feishu.cn/"><img alt="Feishu" src="https://img.shields.io/badge/Feishu%20%2F%20Lark-WebSocket-00A1E9?style=flat-square"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.5.0-black?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black?style=flat-square">
</p>

<p>
  <a href="#演示">演示</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#飞书里怎么用">飞书里怎么用</a> ·
  <a href="#gateway-后台自动化">Gateway</a> ·
  <a href="#claude-code-plugin-marketplace">Marketplace</a> ·
  <a href="#开发">开发</a>
</p>

## 演示

Claude Code 的完整回复会以飞书流式卡片呈现。你可以直接在飞书里提问、看思考过程、收到最终回复。

<p align="center">
  <img src="pics/talk-demo.gif" alt="Ask Claude Code from Feishu" width="760">
</p>

第一次启动时，CLI 会引导你完成 Claude Code、飞书应用和后台服务配置。飞书授权可以直接在终端里扫码完成。

<p align="center">
  <img src="pics/cli-demo.png" alt="CLI onboarding with QR code" width="820">
</p>

配置完成后，在飞书里发送 `/menu` 打开交互菜单。菜单负责会话切换、目录上下文、Gateway 服务和指令入口。

<p align="center">
  <img src="pics/menu-demo.png" alt="Feishu menu card" width="820">
</p>

## 为什么需要它

Claude Code 很适合本地工程任务，但团队沟通、移动端查看、后台自动化通知通常发生在飞书里。`oh-my-feishu` 把两边接起来：

- 你在飞书里发消息，Claude Code 在本机或项目目录里处理。
- Claude Code 知道当前飞书会话上下文，需要飞书能力时按需读取 skill。
- 后台 Gateway 任务只返回最终结果，不像普通对话一样刷中间过程。
- 所有能力通过 WebSocket 长连接工作，不要求你暴露公网回调地址。

## 功能特性

| 能力 | 说明 |
| --- | --- |
| 飞书原生对话 | 普通消息直接进入 Claude Code，回复以流式卡片展示。 |
| 交互式 `/menu` | 卡片菜单支持直接对话、目录会话、历史会话、Gateway 服务和指令菜单。 |
| 目录会话 | 把某个飞书会话绑定到本地项目目录，适合代码修改、构建、调试。 |
| Direct Chat Workspace | 未绑定目录的直接对话运行在仓库内 `workspace/`，fresh clone 后自动初始化。 |
| Gateway 后台任务 | 将后台功能抽象成 `trigger -> feature -> Claude task -> result`。 |
| Web 服务监控 | 注册 traceback URL，内容变化后触发后台 Claude Code 分析和修复流程。 |
| Claude Code Skills | 内置飞书技能包，支持 IM、文档、日历、云文档等能力按需发现。 |
| Plugin Marketplace | 仓库本身可作为 Claude Code plugin marketplace 添加到其它项目。 |

## 快速开始

当前版本暂不发布到 npm。安装方式是克隆仓库、本地构建，然后用 `npm link` 安装系统级 CLI。

### 1. 准备环境

- Node.js >= 18
- 已安装 Claude Code CLI，并完成 Claude Code 登录或鉴权
- 一个飞书 / Lark 自建应用
- 可选：GitHub Token，用于自动修复、PR、仓库相关任务

### 2. 安装 CLI

```bash
git clone https://github.com/yjzhang2003/oh-my-feishu.git
cd oh-my-feishu

npm install
npm run build
npm link
```

安装完成后，任意目录都可以使用：

```bash
oh-my-feishu
```

进入交互式 CLI 后，按界面提示完成：

- Claude Code 状态检查
- 飞书应用配置
- QR 扫码授权
- PM2 后台服务启动
- 服务状态检查

### 3. 在飞书里打开菜单

服务启动后，在机器人会话里发送：

```text
/menu
```

然后从卡片菜单开始使用。

## 配置

交互式 CLI 会覆盖大部分配置。你也可以手动创建 `.env`，参考 `.env.example`：

```bash
cp .env.example .env
```

常用变量：

| 变量 | 用途 |
| --- | --- |
| `LARK_APP_ID` | 飞书 / Lark 应用 ID。 |
| `LARK_APP_SECRET` | 飞书 / Lark 应用 Secret。 |
| `GITHUB_TOKEN` | 可选，用于自动修复和仓库操作。 |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | 可选，默认目标仓库。 |
| `REPO_ROOT` | 可选，指定 oh-my-feishu 仓库根目录。 |

飞书应用侧建议开启：

- 事件订阅：使用长连接接收事件 / 回调
- 消息事件：接收用户消息
- 卡片回调：处理按钮、表单提交
- 卡片权限：创建与更新卡片
- 机器人菜单权限：可选，用于创建 Bot 菜单

## 飞书里怎么用

### 普通对话

直接给机器人发送消息即可。常规问答会直接回答；如果用户请求飞书操作，Claude Code 会按需读取 `lark-chat-guide` skill。

### 菜单

```text
/menu
```

打开主菜单：

- 新建会话：切换直接对话或绑定目录会话
- 历史会话：恢复最近使用过的目录上下文
- Gateway：进入后台自动化服务列表
- 指令菜单：查看 slash commands

### 指令

| 指令 | 说明 |
| --- | --- |
| `/menu` | 打开交互菜单。 |
| `/status` | 查看 Claude CLI、WebSocket、GitHub、服务注册状态。 |
| `/service list` | 查看已注册监控服务。 |
| `/service add <name> <owner/repo> <url>` | 注册 Web 服务监控。 |
| `/service enable <name>` | 启用监控服务。 |
| `/service disable <name>` | 停用监控服务。 |
| `/repair <context>` | 触发后台修复流程。 |

## 会话模型

`oh-my-feishu` 有两种聊天上下文。

### 直接对话

普通飞书对话运行在仓库内 `workspace/` 目录。服务启动时会自动初始化：

```text
workspace/.claude/settings.json
workspace/.claude/.env
```

这个模式适合问答、飞书操作、轻量任务。

### 目录会话

目录会话会把飞书会话绑定到指定本地项目目录：

```bash
oh-my-feishu session new ./my-project
```

也可以在 `/menu` 中选择“目录会话”并输入路径。创建后，oh-my-feishu 会把飞书能力插件安装到该目录的 Claude Code 配置中，并通过 Gateway 转发飞书消息。

## Gateway 后台自动化

Gateway 用于处理“不是普通聊天”的后台任务。它的执行模型是：

```text
Trigger -> Gateway Feature -> Main Claude Code Task -> Result Publisher
```

当前内置 Gateway 服务：

### Web 服务监控

在飞书中进入：

```text
/menu -> Gateway -> Web 服务监控 -> 新建监控
```

填写：

- 服务名称
- GitHub 仓库：`owner/repo`
- Traceback URL

第一次轮询只记录基线 hash；之后 traceback 内容变化时，会触发后台 Claude Code 任务。Gateway 任务默认静默执行，只把最终结果发回飞书。

CLI 侧也可以查看 Gateway 状态：

```bash
oh-my-feishu gateway list
oh-my-feishu gateway status
oh-my-feishu gateway trigger <feature> <eventType> '<jsonPayload>'
```

更多架构细节见 [GATEWAY_FEATURES.md](GATEWAY_FEATURES.md)。

## Claude Code Plugin Marketplace

本仓库也是 Claude Code plugin marketplace。其它项目可以添加 marketplace 后安装 oh-my-feishu 插件：

```bash
claude plugin marketplace add https://github.com/yjzhang2003/oh-my-feishu
claude plugin install oh-my-feishu@oh-my-feishu-marketplace --scope project
```

本地开发时可以直接使用仓库路径：

```bash
claude plugin marketplace add /path/to/oh-my-feishu --scope project
claude plugin install oh-my-feishu@oh-my-feishu-marketplace --scope project
```

插件会让 Claude Code 知道自己正在通过飞书与用户对话，并在需要飞书操作时读取对应 skill。

## 架构

```text
Feishu / Lark
    |
    | WebSocket events + card callbacks
    v
oh-my-feishu Gateway
    |-- MessageRouter       普通消息、slash commands、会话路由
    |-- CardDispatcher      菜单按钮、表单提交、卡片回调
    |-- Gateway Features    status / service-admin / repair / web-monitor
    |-- SessionManager      direct chat 和目录会话
    v
Claude Code CLI
    |-- workspace skills
    |-- project skills
    v
Feishu result cards / messages
```

常规聊天走流式卡片；Gateway 任务走非流式 runner，只发布最终结果。

## 开发

```bash
npm install
npm run build
npm test -- --run
```

常用命令：

```bash
npm start              # 直接启动服务
npm run start:prod     # 使用 PM2 启动
npm run restart        # 重启 PM2 服务
npm run logs           # 查看 PM2 日志
oh-my-feishu help      # 查看 CLI 命令
```

项目结构：

```text
src/
  cli/                 # 全局 CLI 和交互式配置
  feishu/              # 飞书 WebSocket、消息路由、卡片、命令
  gateway/             # 会话管理和 Gateway feature runtime
  monitor/             # TracebackMonitor
  service/             # 服务注册表
  trigger/             # Claude Code 调用器
oh-my-feishu-plugin/   # Claude Code plugin 和 skills
workspace/             # direct chat 默认工作区
docs/                  # CardKit 文档和设计约定
pics/                  # README 截图与演示素材
```

贡献和扩展说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 常见问题

### 为什么暂时不用 `npm install -g oh-my-feishu`？

当前还没有发布到包托管。请使用 `git clone -> npm install -> npm run build -> npm link`。

### 普通对话和 Gateway 任务有什么区别？

普通对话会流式返回中间内容，适合问答和协作。Gateway 任务是后台自动化，只返回最终结果，适合监控、修复、定时任务、Webhook 等场景。

### 飞书里没有看到回复怎么办？

先检查：

```bash
oh-my-feishu gateway status
pm2 status oh-my-feishu
pm2 logs oh-my-feishu
```

然后确认飞书应用已启用长连接事件订阅，并且 `LARK_APP_ID` / `LARK_APP_SECRET` 配置正确。

### Web 服务监控为什么第一次没有触发？

第一次读取 traceback URL 只记录基线 hash，避免把历史错误当成新错误。后续内容变化才会触发 Gateway 任务。

## Roadmap

- 发布到 npm 包托管
- 增加 README 头图和更多演示素材
- Gateway 服务市场和更多服务类型
- Web 服务监控的列表、编辑、删除卡片界面
- 更完整的飞书能力测试和权限检查

## License

MIT
