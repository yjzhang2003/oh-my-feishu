---
title: 部署与网站
description: 说明 showcase 网站如何部署到 Vercel，以及公开文档和私有草稿的发布边界。
---

# 部署与网站

## 项目结构

公开网站代码位于 `showcase/`。VitePress 页面和公开文档位于：

```text
showcase/docs/
```

根目录 `docs/` 是私有草稿区，用于周报、临时方案和内部记录，不会被网站读取，也不应该被提交到公开仓库。

## Vercel 配置

Vercel 项目根目录应保持为仓库根目录，并由根目录 `vercel.json` 指定构建。不要把 Vercel Root Directory 改成 `showcase`。

推荐配置保持为：

```text
Framework Preset: VitePress
Install Command: npm ci --prefix showcase
Build Command: npm run build --prefix showcase
Output Directory: showcase/docs/.vitepress/dist
```

## 构建与发布流程

推送到 GitHub 主分支后，Vercel 会自动构建和发布。构建会在 `showcase` 中安装依赖，然后由 VitePress 生成静态站点。

生成结果包含静态页面、图片资源、manifest、favicon 和 VitePress 本地搜索索引。站点不再维护 `/api/docs/search` serverless 接口。

## 文档发布边界

新增公开文档时，直接在 `showcase/docs/` 下新增 Markdown 文件，并填写 VitePress frontmatter：

```yaml
---
title: 页面标题
description: 页面摘要
---
```

不要在公开文档里写个人路径、私有 token、内部周报、未公开客户信息或临时讨论结论。

## 发布前检查

本地至少运行：

```bash
npm run build --prefix showcase
```

如果改动了根目录私有 `docs/`，还应该确认这些文件没有被 Git 跟踪：

```bash
npm run check:private-docs
```

## 常见问题

如果 Vercel 构建失败，先确认 `vercel.json` 的输出目录是否仍为 `showcase/docs/.vitepress/dist`。

如果文档搜索没有结果，确认 VitePress build 是否成功生成搜索索引，并检查页面内容是否位于 `showcase/docs/`。

## 下一步

如果你要扩写使用文档，回到 [文档概览](/docs/) 查看文档组织方式。如果你要验证产品功能，优先阅读 [安装与启动](/docs/install/) 和 [飞书配置](/docs/feishu/)。
