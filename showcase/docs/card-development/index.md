---
title: 卡片开发规范
description: oh-my-feishu 飞书卡片的设计、流式更新和 CardKit 开发约定。
---

# 卡片开发规范

oh-my-feishu 的飞书交互大量依赖卡片。菜单、会话回复、Web Monitor 管理、确认式修复都需要在移动端和桌面端稳定展示，因此卡片开发优先考虑可维护、可更新和可排障。

这篇文档整理项目内公开的卡片开发约定。它不是飞书 CardKit API reference，而是说明在本项目里应该怎么设计卡片、怎么做流式更新、哪些写法容易破坏体验。

## 适用范围

这套规范适用于下面几类卡片：

- 主菜单和二级菜单卡片。
- Claude Code 流式回复卡片。
- 目录会话、历史会话和指令菜单卡片。
- Web Monitor 服务注册、详情、确认和结果卡片。
- 后续新增的飞书交互入口。

如果只是发送一条普通文本消息，不需要套用全部规则；只要进入 CardKit 卡片实体，就应该遵守这里的限制。

## 总体原则

卡片优先使用飞书卡片 JSON 2.0 组件，并保持 `update_multi: true`。当前项目依赖 CardKit 对同一张卡片做增量更新，如果关闭多端更新，流式回复和局部更新都会变得不稳定。

`element_id` 使用短 ID，长度控制在 20 个字符以内。同一张卡片内必须唯一，推荐用 `m1`、`p1`、`status_tag`、`pending_hint` 这类稳定、短、可读的 ID。

标题区负责表达状态和上下文。会话类型、目录路径、处理中/完成状态应放在 header 的 `subtitle` 或 `text_tag_list` 里，不要在正文反复重复。

正文区优先使用结构化组件表达层级。长段 Markdown 应拆成明确的小节、表格或可折叠信息，避免一张卡片里出现没有分隔的大段文本。

不要为了视觉效果引入复杂嵌套。容器嵌套太深会影响移动端可读性，也会让 CardKit 局部更新更难维护。

## 菜单卡片

菜单卡片是相对静态的交互入口，可以使用更丰富的布局组件。

推荐使用 `column_set` 做左右入口布局，`flex_mode` 优先选择 `bisect`，这样窄屏下仍然能保持稳定结构。

可点击入口优先使用 `interactive_container`，它比单独按钮更适合表达“标题、说明、图标、动作”组合。按钮更适合明确的确认、取消、返回、继续。

首页只展示一级能力入口，不直接放完整命令表。命令清单、服务详情、历史会话这类信息应放在二级页面里。

二级指令页可以使用 `table` 展示固定命令，避免把命令说明堆成长列表。

图标优先使用 `standard_icon`，例如 `chatbox_outlined`、`add_outlined`、`history_outlined`、`folder_outlined`。新增图标前先确认飞书图标 token 是否可用。

不建议用 `collapsible_panel` 做主导航。菜单入口需要一眼可见，折叠面板会增加操作成本。

## 流式回复卡片

流式回复卡片的核心目标是稳定追加和更新文本，视觉增强必须保守。

初始卡片 body 只放一个可删除的 `pending_hint`，提示用户 Claude Code 正在启动。首次收到 `onTextStart` 或 `onThinkingStart` 后，先通过 `delete_elements` 删除 `pending_hint`，再追加真实内容。

正文流式组件只使用可以被 `/content` 接口更新的 `markdown`。不要把正在流式更新的正文包进 `interactive_container`、`table` 或复杂 `column_set`。

思考内容可以放进 `collapsible_panel`，默认收起，作为次要信息承载。工具调用摘要也应进入思考区域，不要抢正文优先级。

`updateCardContent` 发送的是全量文本，不是 delta。调用方需要维护每个 `element_id` 的累计内容，并保证新内容以前一次内容为前缀，这样飞书才能表现为打字机式输出。

流式刷新需要节流。当前项目按大约 120ms 合并一次增量，避免超过飞书接口频率限制，也避免小段文本过度刷新。

不要关闭 `streaming_mode`。历史实测关闭后可能触发飞书重渲染，导致流式内容消失。

完成态优先更新 header 状态和 summary，不要为了收尾全量重写整张卡片。

## CardKit 接口边界

项目里的 CardKit 封装位于 `src/feishu/card-kit.ts`。新增卡片能力时优先复用这里的方法，而不是在业务逻辑里直接拼 OpenAPI 请求。

常用能力如下：

| 方法 | 用途 | 典型场景 |
| --- | --- | --- |
| `createCard` | 创建卡片实体 | 创建流式回复卡片并拿到 `card_id` |
| `addCardElements` | 追加或插入组件 | 文本开始时追加 markdown，思考开始时追加折叠面板 |
| `updateCardContent` | 更新文本内容 | 流式刷新 markdown 正文 |
| `updateCardProps` | 更新组件属性 | 修改折叠面板状态或局部属性 |
| `deleteCardElements` | 删除组件 | 删除初始 `pending_hint` |
| `updateCardSettings` | 更新卡片设置 | 更新 summary 或流式配置 |
| `updateCardFull` | 全量更新卡片 | 仅用于无法局部表达的兜底场景 |

所有 CardKit 更新都需要递增 `sequence`。同一张卡片上的多次操作必须按顺序递增，否则飞书会拒绝更新。

所有更新都应该带幂等 `uuid`。项目封装会自动生成，业务层不需要自己传。

## 视觉语言

直接对话使用 `turquoise`，图标优先 `chatbox_outlined`。

目录会话使用 `indigo`，图标优先 `folder_outlined`。

处理中状态使用橙色标签，完成状态使用绿色标签，失败状态使用红色标签。

thinking、日志、调试信息使用灰色弱化。它们可以帮助排障，但不应该比最终回答更醒目。

## 常见失败

`300301 Duplicate element_id` 表示同一张卡片里出现重复 `element_id`。检查新增组件的 ID 生成逻辑。

`300302 update_multi property is false` 表示卡片不允许多端更新。检查卡片 JSON 配置，不要关闭 `update_multi`。

`300317 sequence number did not increment` 表示操作序号没有递增。检查并发更新、异常重试和多个 flush 定时器是否共用同一个 sequence。

`200810 card is in an ongoing interaction` 表示用户点击卡片交互期间卡片不能更新。需要等待交互结束后再更新，或把交互回调里的更新逻辑改成更小的动作。

`200860 Card content exceeds limit` 表示卡片体积超限。减少正文、组件数量或嵌套层级，避免接近 30KB 限制。

## 修改检查清单

修改卡片相关代码后，至少检查：

```bash
npm run build
npm test -- --run
```

同时确认：

- 新增图标 token 在飞书里可用。
- 流式正文仍只对 `markdown` 组件调用 `updateCardContent`。
- `element_id` 短、唯一、稳定。
- 同一张卡片的 `sequence` 严格递增。
- 卡片 JSON 大小没有接近 30KB。
- 移动端不会因为复杂布局出现横向溢出。

## 下一步

如果你在排查线上用户的问题，继续阅读 [日志与排障](/docs/logging/)。如果你在新增 Web Monitor 交互，先阅读 [Web Monitor 自动化](/docs/web-monitor/)，确认用户确认和自动 PR 的边界。
