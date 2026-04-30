import type { GatewayEvent, GatewayFeature, GatewayRuntime } from '../types.js';

export interface TracebackDetectedPayload {
  serviceName: string;
  githubOwner: string;
  githubRepo: string;
  tracebackUrl: string;
  tracebackContent: string;
  notifyChatId?: string;
  previousHash?: string;
  currentHash?: string;
}

export const webMonitorFeature: GatewayFeature = {
  name: 'web-monitor',
  triggers: [
    { type: 'traceback.detected', source: 'timer' },
    { type: 'traceback.detected', source: 'webhook' },
    { type: 'traceback.detected', source: 'internal' },
  ],

  async handle(event: GatewayEvent, runtime: GatewayRuntime) {
    if (event.type !== 'traceback.detected') {
      return {
        success: false,
        message: `Unsupported web-monitor event: ${event.type}`,
      };
    }

    const payload = parseTracebackPayload(event.payload);
    const claude = await runtime.invokeMainClaude({
      feature: 'web-monitor',
      instruction: [
        '处理一个 Web 服务 traceback 监控事件。',
        '请读取 auto-repair / service-manager 相关能力，分析错误、尝试修复，并只输出最终结果。',
        '如果完成了修复，请说明修改点、验证结果和后续需要用户处理的事项。',
      ].join('\n'),
      context: {
        eventId: event.id,
        serviceName: payload.serviceName,
        repo: `${payload.githubOwner}/${payload.githubRepo}`,
        tracebackUrl: payload.tracebackUrl,
        tracebackContent: payload.tracebackContent,
        previousHash: payload.previousHash,
        currentHash: payload.currentHash,
      },
      env: {
        SERVICE_NAME: payload.serviceName,
        GITHUB_REPO_OWNER: payload.githubOwner,
        GITHUB_REPO_NAME: payload.githubRepo,
        TRACEBACK_URL: payload.tracebackUrl,
        ...(payload.notifyChatId ? { NOTIFY_CHAT_ID: payload.notifyChatId } : {}),
      },
    });

    if (payload.notifyChatId) {
      const content = claude.success
        ? claude.stdout.trim() || 'Web monitor task completed.'
        : `Web monitor task failed:\n${claude.stderr || claude.stdout || 'Unknown error'}`;
      await runtime.sendFeishuMessage({
        chatId: payload.notifyChatId,
        content,
      });
    }

    return {
      success: claude.success,
      message: claude.success ? claude.stdout : claude.stderr,
      claude,
    };
  },
};

function parseTracebackPayload(payload: unknown): TracebackDetectedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('traceback.detected payload must be an object');
  }

  const value = payload as Partial<TracebackDetectedPayload>;
  const required: Array<keyof TracebackDetectedPayload> = [
    'serviceName',
    'githubOwner',
    'githubRepo',
    'tracebackUrl',
    'tracebackContent',
  ];

  for (const key of required) {
    if (typeof value[key] !== 'string' || !value[key]) {
      throw new Error(`traceback.detected payload missing "${key}"`);
    }
  }

  return value as TracebackDetectedPayload;
}
