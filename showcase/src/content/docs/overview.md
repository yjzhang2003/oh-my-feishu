---
title: 文档概览
eyebrow: Overview
summary: 公开文档的入口，说明 oh-my-feishu 的核心使用路径和文档维护规则。
order: 0
tags:
  - overview
  - docs
  - product
---

## 文档边界

这里展示的是面向使用者和贡献者的公开产品文档。所有会出现在网站 `/docs/` 的内容，都来自 `showcase/src/content/docs/`。

根目录 `docs/` 只作为本地草稿区，用来存放周报、临时方案、内部记录或不适合公开的材料，不会被网站读取。

## 推荐路径

第一次接入时，先阅读安装与启动，再配置飞书入口，然后绑定目录会话。需要后台自动化时，再接入 Web Monitor。

如果你只想了解项目能力，可以先看插件能力概览，再回到具体功能页。

## 维护方式

新增公开文档时，直接在 `showcase/src/content/docs/` 里新增 Markdown 文件，并在 frontmatter 中填写标题、摘要、排序和标签。

搜索接口会自动读取这些 Markdown 内容。不要把公开文档写到根目录 `docs/`。
