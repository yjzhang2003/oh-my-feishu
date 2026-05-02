<h1 align="center">oh-my-feishu</h1>

<p align="center">
  <strong>The best way to use Claude Code on Feishu.</strong>
</p>

<p align="center">
  在飞书里使用 Claude Code 的最佳方式
</p>

<p align="center">
  <a href="https://docs.anthropic.com/en/docs/claude-code"><img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-ready-FF6F61?style=flat-square"></a>
  <a href="https://www.feishu.cn/"><img alt="Feishu" src="https://img.shields.io/badge/Feishu%20%2F%20Lark-ready-00A1E9?style=flat-square"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.5.0-black?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black?style=flat-square">
</p>

<p align="center">
  <img src="pics/frontpage.png" alt="oh-my-feishu front page" width="860">
</p>

<p align="center">
  <a href="#开始使用">开始使用</a> ·
  <a href="#你可以做什么">你可以做什么</a> ·
  <a href="#roadmap">Roadmap</a>
  <a href="#声明">声明</a>
  <a href="#感谢">感谢</a>
</p>

## 开始使用

开始之前，请先安装并配置好：

- Claude Code：确保终端里可以运行 `claude --version`
- lark-cli：确保终端里可以运行 `lark-cli --version`

Claude Code 负责对话和执行任务，lark-cli 负责让 Claude Code 调用飞书能力。

当然，我们的cli也会帮助你进行下载和配置。

先拉取仓库并本地安装：

```bash
git clone https://github.com/yjzhang2003/oh-my-feishu.git
cd oh-my-feishu

npm install
npm run build
npm link
```

然后启动交互式配置：

```bash
oh-my-feishu
```

CLI 会带你完成检查、扫码和服务启动。你不需要记住复杂步骤，只需要跟随界面操作。

完成后，在飞书里发送 `/menu`，就可以从菜单开始使用。

## 你可以做什么

### 开始使用？

无需繁琐的配置，只需安装好后在终端输入`oh-my-feishu`，接下来cli会指导你怎么做。

<p align="center">
  <img src="pics/cli-demo.png" alt="CLI onboarding with QR code" width="600">
</p>

### 在飞书里和 Claude Code 对话

不用切回终端，直接在飞书里问问题、讨论代码、查看 Claude Code 的完整回复。

<p align="center">
  <img src="pics/talk-demo.gif" alt="Ask Claude Code from Feishu" width="520">
</p>

### 用菜单管理工作上下文

通过 `/menu` 切换直接对话、目录会话和历史会话。普通问答可以直接聊；需要处理某个项目时，绑定到对应本地目录。

<p align="center">
  <img src="pics/menu-demo.png" alt="Feishu menu card" width="600">
</p>

### 继续一段 Claude code 会话

如果你走在路上突然有些灵感，想接着你在电脑上的工作继续对话，我们支持在你电脑的任意目录新建会话，或者是继续你之前在电脑上的任意Claude code会话。

<p align="center">
  <img src="pics/resume-pic.png" alt="Resume a talk" width="600">
</p>

### 让 Claude Code 帮你使用飞书

`oh-my-feishu`集成了完整的 lark-cli 技能， Claude Code 知道自己正在通过飞书与用户对话。普通问答直接回答；如果用户请求飞书操作，它会按需读取飞书技能。

<p align="center">
  <img src="pics/auto-feishu.png" alt="Auto generate docs" width="600">
</p>

### 使用 Gateway 后台自动化

Gateway 是后台能力入口。当前已经支持 Web 服务监控：注册 traceback 地址后，内容变化会触发 Claude Code 后台处理，并把最终结果发回飞书。

<p align="center">
  <img src="pics/web-monitor.png" alt="Web monitor" width="600">
</p>

## 只给 Claude Code 加上飞书能力

如果你只是想让你的 Claude Code 项目获得飞书操作能力，可以直接安装我们的 oh-my-feishu plugin：

```bash
claude plugin marketplace add https://github.com/yjzhang2003/oh-my-feishu
claude plugin install oh-my-feishu@oh-my-feishu-marketplace --scope project
```

## Roadmap

- 支持包管理器一键安装
- 增加更多演示素材
- 增加更多 Gateway 服务
- 完善 Web 服务监控的列表、编辑、删除体验
- 让飞书能力在 Claude Code 中更自然地按需发现

## 声明

本项目仍处于开发阶段，已经可以使用，但功能和体验还没有完全完善。如果你有想法、问题或建议，欢迎提 issue，或者直接联系我：<zhangyj2003@foxmail.com>。

另外请注意：本项目中 Claude Code 默认运行在 skip permission 的使用方式下。请确认你理解相关风险，并只在可信环境中使用。

## 感谢

感谢飞书官方的 [larksuite/cli](https://github.com/larksuite/cli)，`oh-my-feishu` 的飞书能力建立在 lark-cli 生态之上。

感谢 [Ink](https://github.com/vadimdemedes/ink)，我们使用 Ink 构建了交互式 CLI。

## License

MIT
