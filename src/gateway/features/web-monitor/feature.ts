import type { GatewayEvent, GatewayFeature, GatewayRuntime } from '../types.js';
import { formatWebMonitorResultMessage } from './cards.js';
import { updateWebMonitorClaudeRun } from './registry.js';
import { buildWebMonitorClaudeTask } from './service-actions.js';

export interface TracebackDetectedPayload {
  serviceName: string;
  githubOwner: string;
  githubRepo: string;
  localRepoPath?: string;
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
    runtime.log.info('web-monitor', 'Handling traceback event', {
      eventId: event.id,
      serviceName: payload.serviceName,
    });

    const claude = await runtime.invokeMainClaude(buildWebMonitorClaudeTask(event, payload));
    updateWebMonitorClaudeRun(payload.serviceName, {
      success: claude.success,
      summary: summarizeClaudeResult(claude),
      finishedAt: new Date().toISOString(),
    });

    if (payload.notifyChatId) {
      await runtime.sendFeishuMessage({
        chatId: payload.notifyChatId,
        content: formatWebMonitorResultMessage(claude),
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

function summarizeClaudeResult(input: { success: boolean; stdout: string; stderr: string }): string {
  const text = (input.success ? input.stdout : input.stderr || input.stdout).trim();
  return (text || (input.success ? 'Claude Code task completed.' : 'Claude Code task failed.')).slice(0, 1200);
}
