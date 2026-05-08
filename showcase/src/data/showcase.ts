export const routes = [
  { href: '/', label: '首页', eyebrow: 'Overview' },
  { href: '/code/', label: '代码展示', eyebrow: 'Core Code' },
  { href: '/value/', label: '产品亮点', eyebrow: 'Product' },
  { href: '/gateway/', label: '自动化', eyebrow: 'Gateway' },
  { href: '/docs/', label: '文档', eyebrow: 'Docs' },
  { href: '/ai/', label: 'AI 亮点', eyebrow: 'AI' },
  { href: '/skill/', label: 'SKILLS', eyebrow: 'Skills' },
];

export const codeModules = [
  {
    title: 'CLI 启动与扫码配置流程',
    anchor: 'cli-onboarding',
    files: ['src/cli/cli.ts', 'src/cli/index.tsx', 'src/feishu/qr-onboarding.ts', 'src/start.ts', 'ecosystem.config.cjs'],
    summary:
      '把 Claude Code、lark-cli、飞书应用注册和 PM2 后台服务包装成一个交互式 CLI onboarding 流程。',
    points: [
      '无子命令时进入 Ink TUI，集中展示 Claude、Feishu、Service 三类状态。',
      '扫码认证成功后把 appId/appSecret 写成 lark-cli 兼容配置。',
      '服务启动前检查 Claude CLI 和飞书配置，再连接飞书 WebSocket。',
    ],
    snippet: `const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  await import('./index.js');
  return;
}

if (command === 'session') {
  const action = args[1] as SessionCommandOptions['action'];
  await handleSessionCommand({ action });
  return;
}`,
  },
  {
    title: '飞书 WebSocket、消息路由与菜单卡片交互',
    anchor: 'feishu-router',
    files: [
      'src/feishu/websocket-connector.ts',
      'src/feishu/message-router.ts',
      'src/feishu/commands/command-registry.ts',
      'src/feishu/interactions/card-dispatcher.ts',
      'src/feishu/card-builder/menu-cards.ts',
    ],
    summary:
      '接收飞书消息事件和卡片按钮事件，把用户输入分发到命令、交互流程或 Claude Code 会话。',
    points: [
      '注册 im.message.receive_v1 和 card.action.trigger。',
      'message_id 去重，避免飞书重复事件导致重复执行。',
      '交互流优先，其次 slash command，最后进入普通 Claude 对话。',
    ],
    snippet: `const commandMatch = text.match(/^(\\/\\S+)(?:\\s+(.*))?$/s);
if (commandMatch) {
  const command = commandMatch[1];
  const args = commandMatch[2]?.trim().split(/\\s+/) || [];
  await this.handleCommand(command, args, chatId, chatType, senderOpenId, messageId);
  return;
}

await this.handleChat(chatId, chatType, text, senderOpenId, messageId);`,
  },
  {
    title: 'Claude Code 会话创建、继续与上下文绑定',
    anchor: 'session-binding',
    files: [
      'src/trigger/invoker.ts',
      'src/feishu/interactions/flows/session-add-flow.ts',
      'src/feishu/interactions/session-store.ts',
      'src/feishu/interactions/session-history-store.ts',
      'src/utils/chat-id.ts',
    ],
    summary:
      '把飞书聊天绑定到本地目录和 Claude session，使移动端也能继续电脑上的 Claude Code 工作。',
    points: [
      'SessionStore 保存 direct/directory 模式和临时 flow。',
      '读取 ~/.claude/projects 下的 jsonl 会话记录，列出历史 session。',
      'invokeClaudeChat 使用 --resume 恢复会话，并指定 cwd。',
    ],
    snippet: `const cwd = context.directory
  ? resolve(context.directory)
  : resolve(env.REPO_ROOT, 'workspace');

const sessionId = context.sessionId || chatIdToSessionId(context.chatId);

const claudeArgs: string[] = ['-p', '--dangerously-skip-permissions'];
claudeArgs.push('--output-format', 'stream-json', '--include-partial-messages', '--verbose');
claudeArgs.push('--resume', sessionId, prompt);`,
  },
  {
    title: 'Claude Code 流式输出到飞书卡片',
    anchor: 'streaming-card',
    files: ['src/feishu/message-router.ts', 'src/feishu/card-kit.ts', 'src/trigger/invoker.ts'],
    summary:
      '用飞书 CardKit 创建流式卡片，把 Claude 文本、思考块和工具调用过程分批更新到飞书中。',
    points: [
      '使用 --output-format stream-json 获取 Claude Code 流式事件。',
      'onTextDelta 和 onThinkingDelta 分别收集正文与思考增量。',
      '120ms 节流更新卡片，降低飞书 API 更新频率压力。',
    ],
    snippet: `const scheduleTextFlush = () => {
  if (textFlushTimer) return;
  textFlushTimer = setTimeout(async () => {
    textFlushTimer = null;
    await doFlushText().catch(() => {});
    if (pendingTextDeltas.length > 0) scheduleTextFlush();
  }, 120);
};`,
  },
];

export const gatewayHighlights = [
  'GatewayEvent 把飞书命令、timer、webhook、CLI 等触发源统一成事件。',
  'GatewayFeatureRegistry 根据 event.type 和 source 匹配 feature。',
  'GatewayRuntime 向 feature 提供 Claude 调用、飞书消息、卡片发送和卡片更新能力。',
  'TracebackMonitor 抓取 traceback URL，计算 hash 后避免重复触发。',
  'web-monitor 支持自动修复，也支持先发确认卡片再由人点击触发。',
];

export const skillHighlights = [
  'marketplace.json 声明本仓库作为 Claude plugin marketplace。',
  'lark-chat-guide 规定普通问答直接输出，飞书操作必须使用 lark-cli。',
  'lark-shared 统一认证、权限、身份选择和安全规则。',
  'gateway-guide 让 Claude 可通过 oh-my-feishu gateway 触发后台 feature。',
  'Web Monitor skills 定义分析、修复、通知、服务管理和安全检查协议。',
];

export const aiHighlights = [
  ['Agent tool use', '通过 lark-cli skills 让 Claude Code 操作飞书生态，而不是只输出文本。'],
  ['Context binding', '把飞书 chatId、本地目录、Claude sessionId 绑定，支持项目级持续工作。'],
  ['Session resume', '使用 --resume 恢复历史 Claude Code 会话，减少重复上下文说明。'],
  ['Event-driven agent', 'Web Monitor 从 traceback 事件触发 Claude 分析或修复。'],
  ['Human-in-the-loop', '确认模式下先分析，再等待用户点击确认修复，保留人工控制。'],
  ['Workflow automation', '服务注册、日志轮询、错误去重、AI 修复和飞书回传构成闭环。'],
];

export const valuePoints = [
  '飞书内直接使用 Claude Code，降低终端依赖。',
  '/menu 管理工作上下文，适合移动端操作。',
  '支持绑定本地目录，适合项目级问答、代码修改和调试。',
  '支持恢复历史 Claude Code 会话。',
  'Web Monitor 发现新错误后触发 Claude Code 分析或修复。',
  '与 lark-cli 生态结合，覆盖 IM、文档、日历、表格、多维表格、任务、云盘等能力。',
  '低门槛 CLI onboarding：Ink TUI、二维码注册、PM2 服务管理。',
];
