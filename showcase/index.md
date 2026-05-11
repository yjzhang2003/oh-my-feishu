---
layout: home

hero:
  name: oh-my-feishu
  text: 在飞书中使用 Claude Code
  tagline: 把本机 Claude Code、飞书机器人、lark-cli skills 和后台自动化接成一条可演示的协作链路。
  image:
    src: /icon-512.png
    alt: oh-my-feishu
  actions:
    - theme: brand
      text: 安装与启动
      link: /docs/install/
    - theme: alt
      text: 飞书配置
      link: /docs/feishu/
    - theme: alt
      text: GitHub
      link: https://github.com/yjzhang2003/oh-my-feishu

features:
  - title: 飞书内使用 Claude Code
    details: 在飞书消息里发起项目问答、代码修改、测试验证和结果总结，不必始终守在终端前。
  - title: 目录会话与历史恢复
    details: 把 chatId 绑定到本地项目目录和 Claude session，让移动端协作也能保留真实工程上下文。
  - title: lark-cli skills 能力
    details: 通过官方 lark-cli 访问 IM、Docs、Drive、Calendar、Base、Sheets 等飞书能力。
  - title: Web Monitor 自动化
    details: 轮询 traceback，识别新错误，触发 Claude Code 分析、确认式修复或自动 PR。
---

## 快速开始

```bash
npm install -g oh-my-feishu
oh-my-feishu
```
