import { writeTrigger } from '../../../trigger/trigger.js';
import type { GatewayEvent, GatewayFeature } from '../types.js';

interface RepairPayload {
  context?: string;
  chatId?: string;
  senderOpenId?: string;
}

export const repairFeature: GatewayFeature = {
  name: 'repair',
  triggers: [{ type: 'repair.requested', source: 'feishu' }],

  async handle(event, runtime) {
    const payload = parsePayload(event.payload);
    const context = payload.context?.trim() || 'Repair requested';

    writeTrigger({
      context,
      source: 'feishu',
      timestamp: new Date().toISOString(),
      metadata: {
        chat_id: payload.chatId,
        sender_open_id: payload.senderOpenId,
        gateway_event_id: event.id,
      },
    });

    const claude = await runtime.invokeMainClaude({
      feature: 'repair',
      skillCommand: '/web-monitor-auto-repair',
      instruction: [
        '严格按 web-monitor-auto-repair 工作流执行。',
        '触发上下文已经写入 workspace/.claude/triggers/latest.json。',
        '这是 Gateway 后台任务，不要输出中间过程；只返回最终结果、修复结论、验证情况和后续动作。',
      ].join('\n'),
      context: {
        eventId: event.id,
        source: event.source,
        repairContext: context,
      },
    });

    return {
      success: claude.success,
      message: claude.success ? claude.stdout : claude.stderr,
      claude,
    };
  },
};

function parsePayload(payload: unknown): RepairPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  return payload as RepairPayload;
}
