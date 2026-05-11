---
title: 部署与网站
eyebrow: Deployment
summary: 说明 showcase 网站如何部署到 Vercel，以及公开文档和私有草稿的发布边界。
order: 6
tags:
  - vercel
  - deployment
  - docs
  - website
---

## Vercel 部署

showcase 网站部署在 Vercel，项目根目录使用 `vercel.json` 指定构建命令。不要把 Vercel Root Directory 改成 `showcase`，也不要选择 Vite preset。

当前站点使用 Astro 和 Vercel adapter。静态页面会预渲染，文档搜索接口通过 Vercel serverless function 提供。

## 域名与构建

生产域名使用 `ohmyfeishu.top`。推送到 GitHub 主分支后，Vercel 会自动构建和发布。

构建会从 `showcase` 安装依赖并生成 `.vercel/output`，其中包含静态页面、图标资源和搜索 API 的 serverless 路由。

## 文档发布边界

公开文档只来自 `showcase/src/content/docs/`。这些 Markdown 会进入网站页面和搜索接口。

根目录 `docs/` 是私有草稿区，默认被 `.gitignore` 忽略，不会被 GitHub 或网站公开。
