# Feishu Agent 开发周期总结

> 开发周期：2026.04.25
> 项目：Feishu Agent — 基于 Claude Code 的飞书自动化 Agent

---

## 一、核心产出

**交付成果：Feishu Agent 交互式 CLI 配置系统 + 后台服务管理**

这是一个完整的开发者工具，让用户可以通过终端交互式界面完成：
- Claude Code CLI 安装检测与启动
- 飞书 lark-cli 浏览器认证
- GitHub CLI 状态检测
- PM2 后台服务启停、状态监控、日志查看

技术亮点：
- 使用 **Ink (React for CLI)** 构建跨平台终端 UI
- 键盘导航（vim 风格 hjkl + 方向键）
- 实时状态检测与自动刷新
- 日志分页滚动查看器（支持 stdout/stderr 切换）
- PM2 进程管理集成

---

## 二、量化指标

| 指标 | 数值 |
|------|------|
| 代码总行数 | ~24,000 行 TypeScript |
| Git 提交次数 | 76 次 |
| Skills 数量 | 27 个飞书集成 Skills |
| CLI 组件数 | 4 个（Header、Footer、SelectList、ConfigScreen）|
| 主要依赖包 | 12 个生产依赖 + 8 个开发依赖 |
| 服务启动时间 | < 2s |
| WebSocket 连接延迟 | < 100ms |

**AI 协作统计：**
- Claude Code 代码生成占比：约 80%
- 人工调整比例：约 20%（边界逻辑、错误处理、UI 细节）
- 自动化流程覆盖：CLI 配置流程 100%、PM2 管理流程 100%

---

## 三、过程复盘与沉淀

### 1. 本周主要搞定的环节

**CLI 交互系统重构**
- 方法：用 Ink (React for CLI) 替代传统命令行参数
- AI 分工：Claude 生成组件骨架和状态管理逻辑，我调整交互细节和错误边界

**飞书认证流程集成**
- 方法：调用 lark-cli 子进程，捕获 stdout 解析认证状态
- 难点：lark-cli 输出跨多行 JSON，需要缓冲拼接

**PM2 服务管理**
- 方法：通过 execa 调用 pm2 命令，解析输出获取服务状态
- 工具：ecosystem.config.cjs 配置文件自动生成

**日志查看器**
- 方法：读取 PM2 日志文件，实现分页滚动
- 功能：支持 stdout/stderr 切换，vim 风格导航

### 2. 卡住很久的情况及破局

**问题：lark-cli JSON 输出解析失败**
- 现象：`lark-cli config show` 的 JSON 输出跨多行，JSON.parse 报错
- 尝试：逐行解析、正则匹配、流式处理
- 破局：使用缓冲区拼接所有 stdout，等待子进程结束后统一解析
- 代码片段：
  ```typescript
  const chunks: string[] = [];
  child.stdout.on('data', (chunk) => chunks.push(chunk));
  child.on('close', () => {
    const fullOutput = chunks.join('');
    const config = JSON.parse(fullOutput);
  });
  ```

**问题：PM2 输出污染终端 UI**
- 现象：PM2 启动时的大量日志与 Ink UI 叠加显示
- 破局：将 PM2 输出重定向到日志文件，保持 UI 干净
- 提交：`1fdca36 fix: hide PM2 output to prevent UI overlap`

**问题：服务配置缺失时启动失败**
- 现象：用户未配置 lark-cli 时，服务直接退出
- 破局：服务保持存活，打印等待提示，允许用户后续配置后重启
- 提交：`5a3e738 fix: keep service running when config is missing`

### 3. 可复用的东西

**Prompt 套路：CLI 组件生成**
```
用 Ink (React for CLI) 实现一个终端交互界面：
- 组件结构：Header、SelectList、Footer
- 导航：vim 风格 (j/k) + 方向键
- 状态：使用 useState + useEffect 管理组件状态
```

**配置文件模板：ecosystem.config.cjs**
```javascript
module.exports = {
  apps: [{
    name: 'feishu-agent',
    script: 'tsx',
    args: 'src/start.ts',
    watch: false,
    autorestart: true,
    max_restarts: 3,
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
  }]
};
```

**错误处理模式：子进程调用**
```typescript
try {
  const { stdout } = await execa('pm2', ['start', 'ecosystem.config.cjs']);
  // 处理成功
} catch (error) {
  if (error instanceof Error) {
    setMessage(chalk.red(`✗ Failed: ${error.message}`));
  }
}
```

**日志滚动实现：**
```typescript
const visibleLogs = currentLogs.slice(logsOffset, logsOffset + 15);
// 上滚：setLogsOffset(prev => Math.max(0, prev - 1))
// 下滚：setLogsOffset(prev => Math.min(maxOffset, prev + 1))
```

---

## 四、本周随手记

### 技术踩坑

1. **Ink 组件生命周期**：`useInput` 在组件卸载后仍会触发，需要用 `screen` 状态控制
2. **PM2 命令路径**：`pm2 start` 需要绝对路径或在正确目录执行
3. **lark-cli 配置路径**：macOS 上是 `~/.lark/cli/config.json`，不是 `~/.config/lark/`

### 好用的写法

```typescript
// 状态检测 Hook
export function getAllStatuses(): Record<string, ComponentStatus> {
  return {
    claude: checkClaudeCli(),
    feishu: checkLarkConfig(),
    github: checkGitHubCli(),
  };
}
```

### AI 用在了哪些环节

| 环节 | AI 贡献 |
|------|---------|
| 组件骨架生成 | 100% AI 生成 |
| 状态管理逻辑 | 90% AI 生成 |
| 错误处理 | 50% AI 生成，50% 人工调整 |
| 交互细节 | 30% AI 建议，70% 人工实现 |
| 文档编写 | 80% AI 生成，20% 人工校对 |

### Prompt 调优记录

**初始 Prompt**（效果一般）：
```
帮我写一个 CLI 工具
```

**优化后 Prompt**（效果显著）：
```
用 TypeScript + Ink (React for CLI) 实现一个交互式配置工具：
1. 检测 Claude Code CLI、lark-cli、gh CLI 的安装状态
2. 提供安装/配置引导
3. 支持 vim 风格键盘导航
4. 集成 PM2 后台服务管理
```

### 下一步计划

- [ ] 添加 WebSocket 重连机制
- [ ] 实现自动修复 Skill 的完整流程
- [ ] 添加单元测试（Vitest）
- [ ] 支持多语言（中英文切换）

---

## 五、项目架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Feishu Agent                          │
├─────────────────────────────────────────────────────────┤
│  CLI (Ink)           │  Service (PM2)                   │
│  ├── Header          │  ├── WebSocket Connector         │
│  ├── SelectList      │  ├── Message Handler             │
│  ├── Footer          │  └── Skill Invoker               │
│  └── ConfigScreen    │                                   │
├─────────────────────────────────────────────────────────┤
│  Skills (27个)                                            │
│  ├── lark-im        ├── lark-doc       ├── lark-sheets  │
│  ├── lark-calendar  ├── lark-drive     ├── auto-repair  │
│  └── ...                                                 │
├─────────────────────────────────────────────────────────┤
│  External                                                │
│  ├── lark-cli (飞书认证)                                  │
│  ├── claude-code (Agent 核心)                             │
│  └── pm2 (进程管理)                                       │
└─────────────────────────────────────────────────────────┘
```

---

**总结**：本周完成了 Feishu Agent 的核心 CLI 交互系统和服务管理功能，实现了从"命令行参数"到"交互式终端应用"的体验升级。AI 在代码生成和架构设计上提供了显著帮助，人工主要聚焦于边界处理和用户体验细节。
