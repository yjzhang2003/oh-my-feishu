export const codeDocs = [
  {
    id: 'architecture',
    nav: '总览',
    title: '核心代码展示总览',
    files: ['src/cli', 'src/feishu', 'src/trigger', 'src/gateway', 'src/monitor', 'oh-my-feishu-plugin'],
    overview:
      '这部分展示项目里最关键的工程代码，以及这些代码如何从飞书入口、会话绑定、Claude Code 调用、流式卡片、Gateway 自动化一路串成可运行的系统。',
    flow: [
      'CLI onboarding：`oh-my-feishu` 一条命令启动交互式配置。',
      '飞书 WebSocket 负责用户入口，MessageRouter 把输入路由到命令、流程或 Claude 会话。',
      'Session 绑定让 Claude Code 拿到本地目录和历史会话，实现有上下文的仓库级工作。',
      '流式卡片让长时间 AI 执行过程可见，120ms 节流更新确保实时性又不过载。',
      'Gateway 与 Web Monitor 让 AI 从被动响应扩展为事件驱动自动化。',
    ],
    snippetTitle: '展示链路',
    snippet: `Feishu message / card action
  → FeishuWebSocket (WebSocket 长连接)
  → MessageRouter / CardDispatcher (路由分发)
  → SessionStore + SessionHistoryStore (会话绑定)
  → invokeClaudeChat / invokeClaudeTask (AI 执行)
  → CardKit streaming update (实时卡片)
  → Feishu result card (结果回传)`,
  },
  {
    id: 'cli',
    nav: 'CLI 启动',
    title: 'CLI 启动与交互式配置',
    files: ['src/cli/cli.ts', 'src/cli/index.tsx', 'src/feishu/qr-onboarding.ts', 'src/start.ts'],
    why:
      '项目要落地，第一步是让用户能稳定启动服务。CLI 入口同时支持交互式 TUI 和命令模式，把安装检查、飞书注册、服务管理、Web Monitor 管理收敛到统一入口。',
    bullets: [
      '无子命令时进入 Ink TUI，适合首次配置和交互式引导。',
      '`session`、`gateway`、`web-monitor` 子命令保留脚本化能力，适合演示和自动化。',
      'QR onboarding 使用飞书设备码注册流程，扫码后自动写入 lark-cli 兼容配置。',
      'PM2 配置支撑后台进程稳定运行和日志持久化。',
    ],
    snippetTitle: 'src/cli/cli.ts — 命令分发',
    snippet: `const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  // 无参数时启动交互式 TUI
  await import('./index.js');
  return;
}

if (command === 'session') {
  const action = args[1] as SessionCommandOptions['action'];
  const opts: SessionCommandOptions = { action };
  if (action === 'new' && subArgs[0]) {
    opts.directory = subArgs[0];
  }
  await handleSessionCommand(opts);
  return;
}

if (command === 'web-monitor') {
  await handleWebMonitorCommand(parseWebMonitorArgs(args.slice(1)));
  return;
}`,
  },
  {
    id: 'feishu-entry',
    nav: '飞书入口',
    title: '飞书 WebSocket、消息路由与卡片交互',
    files: [
      'src/feishu/websocket-connector.ts',
      'src/feishu/message-router.ts',
      'src/feishu/commands/command-registry.ts',
      'src/feishu/interactions/card-dispatcher.ts',
    ],
    why:
      '飞书侧入口需要同时处理普通消息、slash command、卡片按钮和交互流程。代码把 WebSocket 接入、命令注册、卡片分发、Gateway runtime 初始化集中在 FeishuWebSocket 中，再把文本消息交给 MessageRouter。',
    bullets: [
      'EventDispatcher 注册 `im.message.receive_v1` 和 `card.action.trigger` 事件。',
      '`processedMessageIds` 做消息去重，避免飞书重复推送导致重复执行。',
      'MessageRouter 先处理 active flow（如目录输入），再处理 slash command，最后进入 Claude 对话。',
      'CommandRegistry 注册 `/repair`、`/status`、`/service`、`/help`、`/menu`、`/claude` 等命令。',
      'CardDispatcher 统一处理卡片按钮回调，支持确认流程、服务管理等复杂交互。',
    ],
    snippetTitle: 'src/feishu/message-router.ts — 消息路由',
    snippet: `// 1. 先检查交互流程（如目录输入）
const session = this.sessionStore.get(chatId);
if (session.flow !== 'none') {
  await this.handleFlowInput(chatId, text, senderOpenId, session.flow);
  return;
}

// 2. 再检查 slash command
const commandMatch = text.match(/^(\\/\\S+)(?:\\s+(.*))?$/s);
if (commandMatch) {
  const command = commandMatch[1];
  const args = commandMatch[2]?.trim().split(/\\s+/) || [];
  await this.handleCommand(command, args, chatId, chatType, senderOpenId, messageId);
  return;
}

// 3. 默认进入 Claude 对话
await this.handleChat(chatId, chatType, text, senderOpenId, messageId);`,
  },
  {
    id: 'session',
    nav: '会话绑定',
    title: 'Claude Code 会话创建与目录绑定',
    files: [
      'src/feishu/interactions/flows/session-add-flow.ts',
      'src/feishu/interactions/session-store.ts',
      'src/feishu/interactions/session-history-store.ts',
      'src/utils/chat-id.ts',
    ],
    why:
      '普通聊天机器人通常只知道聊天文本，不知道本地项目。目录会话让飞书 chatId 绑定到本地目录和 Claude sessionId，Claude Code 可以在真实 cwd 中继续历史工作。',
    bullets: [
      'SessionAddFlow 校验目录路径，列出该目录已有 Claude Code session。',
      '用户可以选择已有 session 继续，也可以新建目录会话。',
      '`completeSession` 把 directory 和 sessionId 写入当前 chat 的 SessionStore。',
      'SessionHistoryStore 记录历史绑定，方便后续恢复和查看。',
      '`chatIdToSessionId` 生成稳定的 session ID，支持同一聊天持续上下文。',
    ],
    snippetTitle: 'src/feishu/interactions/flows/session-add-flow.ts',
    snippet: `// 获取目录下已有的 Claude Code sessions
const sessions = await listSessions(trimmedDir);

if (sessions.length > 0) {
  // 已有历史会话，让用户选择
  return {
    card: createDirectorySessionSelectCard(trimmedDir, sessions).card,
    toast: '请选择要连接的 Claude Code 会话',
  };
} else {
  // 首次绑定，直接创建新会话
  await this.completeSession(chatId, trimmedDir, null);
  return {
    card: createDirectorySessionSuccessCard(trimmedDir, null).card,
    toast: '目录会话已创建',
  };
}`,
  },
  {
    id: 'claude-invoker',
    nav: 'Claude 调用',
    title: 'Claude Code 调用与流式输出',
    files: ['src/trigger/invoker.ts', 'src/utils/chat-id.ts', 'workspace/.claude/.env'],
    why:
      'Claude Code 是项目的 AI 执行核心。invoker 负责设置 cwd、恢复 session、注入飞书上下文环境变量，并解析 Claude stream-json 输出。',
    bullets: [
      '`directory` 存在时用用户绑定目录作为 cwd，否则回到 workspace 默认目录。',
      '用 `chatIdToSessionId` 生成稳定 session，支持同一聊天持续上下文。',
      '使用 `--output-format stream-json`、`--include-partial-messages` 获取增量事件。',
      '如果 `--resume` 找不到历史会话，自动用 `--session-id` 重试创建新会话。',
      '`buildFeishuContextEnv` 注入飞书上下文环境变量，让 Claude 知道发送者和聊天信息。',
    ],
    snippetTitle: 'src/trigger/invoker.ts — Claude 调用参数',
    snippet: `// 确定工作目录
const cwd = context.directory
  ? resolve(context.directory)
  : resolve(env.REPO_ROOT, 'workspace');

// 构建飞书上下文环境变量
const contextEnv = buildFeishuContextEnv(context);

// 生成稳定的 session ID
const sessionId = context.sessionId || chatIdToSessionId(context.chatId);

// 构建 Claude CLI 参数
const claudeArgs: string[] = [
  '-p',
  '--dangerously-skip-permissions',
  '--output-format', 'stream-json',
  '--include-partial-messages',
  '--verbose',
  '--resume', sessionId,
  prompt
];`,
  },
  {
    id: 'streaming-card',
    nav: '流式卡片',
    title: 'Claude Code 流式输出到飞书卡片',
    files: ['src/feishu/message-router.ts', 'src/feishu/card-kit.ts', 'src/trigger/invoker.ts'],
    why:
      'AI coding 任务经常耗时较长。如果只等待最终文本，飞书用户会觉得无反馈。流式卡片把等待、思考、工具调用和正文输出持续展示出来。',
    bullets: [
      '先通过 CardKit API 创建 `streaming_mode` 卡片，立即发送到飞书。',
      '正文和思考分别进入不同 markdown 元素，思考内容放入折叠面板。',
      '用 `accumulated` Map 维护每个元素的完整内容，因为 `updateCardContent` 发送的是全文。',
      '120ms 节流更新，控制飞书卡片更新频率，避免 API 过载。',
      'CardKitManager 封装 `createCard`、`updateCardContent`、`updateCardProps` 等操作。',
    ],
    snippetTitle: 'src/feishu/message-router.ts — 流式更新节流',
    snippet: `// 节流更新，避免 API 过载
const scheduleTextFlush = () => {
  if (textFlushTimer) return;
  textFlushTimer = setTimeout(async () => {
    textFlushTimer = null;
    await doFlushText().catch(() => {});
    // 如果还有待处理的 delta，继续调度
    if (pendingTextDeltas.length > 0) scheduleTextFlush();
  }, 120); // 120ms 节流
};

// 处理文本增量
for (const delta of pendingTextDeltas) {
  accumulatedText += delta;
}
// 更新卡片内容
await this.cardKitManager.updateCardContent(
  cardId,
  'streaming-content',
  accumulatedText,
  sequence++
);`,
  },
  {
    id: 'gateway',
    nav: 'Gateway',
    title: 'Gateway feature runner 与事件驱动自动化',
    files: [
      'src/gateway/features/runner.ts',
      'src/gateway/features/runtime.ts',
      'src/gateway/features/web-monitor/feature.ts',
      'src/monitor/traceback-monitor.ts',
    ],
    why:
      'Gateway 把飞书命令、timer、webhook、internal 事件统一成 GatewayEvent，再由 feature registry 匹配处理器。Web Monitor 基于 traceback hash 变化触发 AI 分析或修复。',
    bullets: [
      '`GatewayFeatureRunner` 负责 feature 匹配、日志、异常兜底和统一返回结构。',
      '`GatewayRuntime` 向 feature 注入 `invokeMainClaude`、`sendFeishuMessage`、`sendFeishuCard`、`updateCard` 等能力。',
      'Web Monitor 支持 `requireConfirmation`，必要时先发确认卡片，保留 human-in-the-loop。',
      '`TracebackMonitor` 支持 json/text/html traceback 提取，并用 SHA-256 hash 去重。',
      '自动 PR 配置支持设置目标分支、Draft 模式和分支前缀。',
    ],
    snippetTitle: 'src/gateway/features/runner.ts — Feature 匹配与执行',
    snippet: `async run(event: GatewayEvent): Promise<GatewayResult> {
  // 根据 event type 匹配 feature
  const feature = this.options.registry.match(event);
  if (!feature) {
    return {
      success: false,
      message: \`No Gateway feature matched event "\${event.type}"\`,
    };
  }

  try {
    // 执行 feature handler
    return await feature.handle(event, this.options.runtime);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // 异常兜底，返回统一错误结构
    return { success: false, message };
  }
}`,
  },
  {
    id: 'traceback-monitor',
    nav: 'Web Monitor',
    title: 'Traceback Monitor 日志监控与 AI 触发',
    files: ['src/monitor/traceback-monitor.ts', 'src/gateway/features/web-monitor/traceback-trigger.ts'],
    why:
      'Web Monitor 是自动化的核心组件。它定时轮询服务的日志端点，检测新的 traceback，并触发 Claude Code 进行分析或修复。',
    bullets: [
      '支持 json、text、html 三种日志格式，自动提取 traceback 内容。',
      'SHA-256 hash 去重，只有新的 traceback 才会触发 AI。',
      '可配置轮询间隔，默认 60 秒检查一次。',
      '触发时通过 Gateway event 分发，复用 feature runner 的能力注入。',
      '支持 `requireConfirmation` 模式，先发确认卡片让用户决定是否执行。',
    ],
    snippetTitle: 'src/monitor/traceback-monitor.ts — Traceback 提取',
    snippet: `function extractLatestTraceback(
  content: string,
  urlType: 'json' | 'text' | 'html'
): { traceback: string; hash: string } | null {
  if (urlType === 'json') {
    try {
      const parsed = JSON.parse(content);
      const entries = Array.isArray(parsed) ? parsed : parsed.logs ?? [parsed];

      // 反向遍历找最新的 traceback
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const tracebackText = entry.traceback ?? entry.error ?? entry.message;

        if (tracebackText && typeof tracebackText === 'string') {
          const trimmed = tracebackText.trim();
          if (trimmed) {
            return {
              traceback: trimmed,
              hash: hashTracebackContent(trimmed), // SHA-256
            };
          }
        }
      }
    } catch { /* fall through */ }
  }
  // text/html 格式处理...
}`,
  },
  {
    id: 'plugin-skills',
    nav: 'Skills',
    title: 'Claude plugin、skills 与飞书能力扩展',
    files: [
      'src/marketplace/index.ts',
      '.claude-plugin/marketplace.json',
      'oh-my-feishu-plugin/.claude-plugin/plugin.json',
      'oh-my-feishu-plugin/skills/lark-chat-guide/SKILL.md',
      'oh-my-feishu-plugin/skills/gateway-guide/SKILL.md',
    ],
    why:
      'Claude Code 擅长代码仓库任务，但不知道飞书 API 的调用规则。项目用 plugin 和 skills 把飞书业务域、lark-cli 命令、安全约束和 Gateway 协议交给 Claude。',
    bullets: [
      '`marketplace.json` 声明本仓库作为 Claude plugin marketplace，支持 `claude plugin add`。',
      '`lark-chat-guide` 规定普通聊天直接输出，飞书操作走 `lark-cli` 命令行。',
      '`gateway-guide` 让 Claude 能通过 `oh-my-feishu gateway` 触发后台 feature。',
      'Web Monitor skills 定义自动分析、修复、通知、服务管理和安全检查协议。',
      '技能文件使用 Markdown 格式，易于维护和扩展。',
    ],
    snippetTitle: 'oh-my-feishu-plugin/skills/lark-chat-guide/SKILL.md',
    snippet: `## 核心规则

当用户只是普通聊天（提问、编程帮助、分析讨论、闲聊等），
直接将回复内容输出到 stdout。

当用户请求涉及飞书平台操作（发消息、查日程、创建文档、管理群聊等），
使用对应的 lark 技能通过 lark-cli 执行操作，
然后通过 lark-cli im +messages-send 将操作结果发送给用户。

## 安全约束

- 永远不要在回复中暴露 app_id、app_secret 或用户敏感信息
- 群操作前检查 bot 是否在群内
- 文档操作前检查是否有读写权限`,
  },
];
