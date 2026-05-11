---
title: Web Monitor 自动化
description: 轮询 traceback 地址，识别新错误，并触发 Claude Code 分析或修复。
---

# Web Monitor 自动化

## 使用前准备

你需要准备服务名称、GitHub 仓库、traceback URL，以及是否允许自动创建 PR。目标仓库需要能被本机访问，Claude Code 也需要能在该仓库里运行必要验证命令。

如果希望修复结果进入 PR，需要确认 GitHub CLI、权限和远端仓库配置可用。没有 GitHub 配置时，Web Monitor 仍然可以分析错误，但不能自动创建 PR。

## 推荐流程

### 注册监控服务

可以通过飞书卡片、自然语言或 CLI 注册服务。一个服务通常包含：

- 服务名称：用于飞书卡片和本地目录命名。
- GitHub 仓库：用于 clone 或定位服务代码。
- Traceback URL：用于轮询最新错误。
- PR 策略：决定是否自动创建 draft 或 ready PR。

注册后，服务信息会进入本地 registry，后续轮询和修复都基于这份配置。

### 建立错误基线

首次检查只记录当前 traceback hash，不会立刻触发修复。这样可以避免把历史错误当成新错误。

之后只有 traceback 内容变化时，才会产生 detected 事件。相同错误重复出现时会被 hash 去重。

### 触发分析或修复

确认模式会先把错误摘要发送到飞书卡片，用户点击“开始分析”后才调用 Claude Code。自动模式会直接进入分析或修复流程。

修复时 Claude Code 会进入服务仓库目录，结合 traceback、仓库代码和配置约束给出根因、改动、验证结果和 PR 信息。

## Traceback 识别与去重

TracebackMonitor 支持 JSON、文本和 HTML 日志格式。它会尽量提取最新异常片段，并把内容计算成 hash。

如果你手动清除 hash，下次轮询会重新检测相同错误。这个操作适合在确认旧错误已经修复后，想重新触发一次分析。

## 自动 PR 策略

自动 PR 适合低风险、可验证、改动范围清晰的问题。建议默认使用 draft PR，让人类在合并前检查 diff 和测试结果。

如果错误涉及生产数据、权限、迁移或大范围重构，不建议直接自动修复。可以只开启分析，让 Claude Code 输出根因和建议。

## 常见问题

如果没有触发事件，先确认 traceback URL 是否能从本机访问，并检查服务是否处于启用状态。

如果一直重复触发，检查 traceback 内容是否包含时间戳、请求 ID 或随机字段。必要时需要让日志端返回更稳定的异常片段。

如果 Claude Code 无法创建 PR，检查 GitHub 权限、仓库远端、分支保护和本地 Git 状态。

## 下一步

Web Monitor 是后台自动化能力。需要理解飞书里如何人工发起项目协作时，阅读 [目录会话](/docs/sessions/)。需要了解部署和网站文档发布时，阅读 [部署与网站](/docs/deployment/)。
