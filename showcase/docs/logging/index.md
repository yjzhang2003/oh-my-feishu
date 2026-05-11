---
title: 日志与排障
description: npm 全局安装用户如何查看 oh-my-feishu 后台日志，并安全提供 debug 信息。
---

# 日志与排障

通过 npm 全局安装并启动服务后，oh-my-feishu 会在用户本机保存后台日志。日志不会自动上传，排障时需要用户主动查看或打包后提供。

默认日志目录是：

```bash
~/.oh-my-feishu/logs/
```

## 日志文件

常见文件如下：

| 文件 | 内容 | 什么时候看 |
| --- | --- | --- |
| `pm2-out.log` | 服务 stdout，启动过程和普通 console 输出 | 服务能启动但行为异常 |
| `pm2-error.log` | 服务 stderr，崩溃、未捕获异常和 PM2 错误 | 服务启动失败或自动重启 |
| `system.log` | 业务日志，包含 feishu、chat、cardkit、service、gateway 等分类 | 大多数功能问题优先看 |
| `messages.log` | 飞书收发消息摘要 | 判断是否收到消息、是否发出回复 |
| `claude.log` | Claude Code stdout 结构化记录 | 判断 Claude 调用过程和输出 |

`pm2-out.log` 和 `pm2-error.log` 由 PM2 管理。`system.log`、`messages.log`、`claude.log` 由项目内 logger 写入。

## 常用命令

查看服务状态：

```bash
pm2 status
```

查看 PM2 最近日志：

```bash
pm2 logs oh-my-feishu --lines 100
```

查看日志目录：

```bash
ls -lah ~/.oh-my-feishu/logs
```

查看业务日志：

```bash
tail -n 200 ~/.oh-my-feishu/logs/system.log
```

查看启动和崩溃错误：

```bash
tail -n 200 ~/.oh-my-feishu/logs/pm2-error.log
```

查看飞书消息是否进入服务：

```bash
tail -n 200 ~/.oh-my-feishu/logs/messages.log
```

## 调试顺序

### 服务是否启动

先看 PM2 状态：

```bash
pm2 status
```

如果没有 `oh-my-feishu` 进程，回到 CLI 的 Service 页面重新启动服务。如果进程不断重启，优先查看 `pm2-error.log`。

### 飞书是否连接

服务启动后，`pm2-out.log` 或 `system.log` 里应该能看到 WebSocket 连接、飞书配置检查和服务启动信息。

如果飞书里发消息没有任何响应，先看 `messages.log` 是否有新记录。没有新记录通常说明事件订阅、机器人入口、应用权限或 WebSocket 连接有问题。

### Claude 是否执行

如果 `messages.log` 有入站消息，但没有有效回复，查看 `system.log` 的 `chat`、`flow`、`claude-process` 分类。

如果已经进入 Claude Code 执行流程，再看 `claude.log`。这里会记录 Claude stdout 的结构化内容，适合判断工具调用、命令输出和最终结果。

### 卡片是否更新

如果飞书能收到卡片但卡片不刷新，查看 `system.log` 中 `cardkit` 分类。

重点关注：

- `createCard response`
- `updateCardContent failed`
- `addCardElements failed`
- `deleteCardElements failed`
- `sequence number`
- `Duplicate element_id`
- `Card content exceeds limit`

卡片相关开发约定见 [卡片开发规范](/docs/card-development/)。

## 打包日志

用户可以把日志目录打包后发给维护者：

```bash
tar -czf oh-my-feishu-logs.tgz ~/.oh-my-feishu/logs
```

如果只需要最近内容，可以先导出几份文本：

```bash
tail -n 300 ~/.oh-my-feishu/logs/system.log > system.tail.log
tail -n 300 ~/.oh-my-feishu/logs/pm2-error.log > pm2-error.tail.log
tail -n 300 ~/.oh-my-feishu/logs/messages.log > messages.tail.log
```

## 隐私提醒

日志可能包含飞书消息片段、`chatId`、`senderId`、卡片请求摘要、服务名称、仓库名和 traceback URL。

当前版本不会自动脱敏，也不会自动上传日志。把日志发给维护者前，建议先检查并删除：

- token、app secret、cookie、authorization header。
- 私有仓库地址和内部域名。
- 用户真实消息内容。
- 不应该公开的 traceback 内容。

`messages.log` 会截断消息内容，但仍可能包含敏感片段。公开 issue 里不要直接贴完整日志包。

## 环境变量

日志级别默认是 `info`。如果需要更多细节，可以在启动服务时设置：

```bash
LOG_LEVEL=debug
```

文件日志默认开启。设置下面的变量可以关闭文件日志：

```bash
LOG_FILE=false
```

控制台日志默认开启。设置下面的变量可以关闭控制台输出：

```bash
LOG_CONSOLE=false
```

普通用户通常不需要修改这些变量。排障时优先使用默认日志。

## 下一步

如果是首次安装后没有响应，先看 [飞书配置](/docs/feishu/) 的权限和事件订阅部分。如果是卡片显示、流式更新或按钮交互问题，继续看 [卡片开发规范](/docs/card-development/)。
