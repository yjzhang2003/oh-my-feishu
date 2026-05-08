---
title: Web Monitor 自动化
eyebrow: Automation
summary: 轮询 traceback 地址，识别新错误，并触发 Claude Code 分析或修复。
order: 4
tags:
  - web monitor
  - traceback
  - automation
  - repair
---

## 注册监控服务

Web Monitor 服务包含服务名称、GitHub 仓库、traceback URL、轮询间隔和 PR 策略等配置。可以通过飞书卡片、自然语言或 CLI 创建。

服务注册后会保存本地仓库路径，后续 Claude Code 分析和修复会进入真实项目目录执行。

## 错误提取与去重

TracebackMonitor 支持 JSON、文本和 HTML 日志格式。它会提取最新 traceback，计算 hash，并避免同一错误重复触发。

首次检查只建立基线，避免把历史错误当作新事件。只有 traceback 内容变化时，才会发出 detected 事件。

## 分析与修复

自动模式会直接调用 Claude Code 进入分析或修复流程。确认模式会先把新错误发送到飞书卡片，等待用户点击后再继续。

修复流程受到路径、diff 大小、测试命令、secret 和 Git 行为约束。开启自动 PR 后，修复结果可以进入 draft 或 ready PR。
