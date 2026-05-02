import { listServices } from '../../../service/registry.js';
import { checkClaudeCli } from '../../../trigger/invoker.js';
import type { GatewayEvent, GatewayFeature } from '../types.js';

interface StatusPayload {
  connected?: boolean;
}

export const statusFeature: GatewayFeature = {
  name: 'status',
  triggers: [{ type: 'status.query', source: 'feishu' }],

  async handle(event: GatewayEvent) {
    const payload = parsePayload(event.payload);
    const claudeStatus = await checkClaudeCli();
    const services = listServices();
    const enabledCount = services.filter((service) => service.enabled).length;

    const text = `📊 System Status

**Claude CLI:** ${claudeStatus.available ? `✅ ${claudeStatus.version}` : '❌ Not available'}
**WebSocket:** ${payload.connected ? '✅ Connected' : '❌ Disconnected'}
**Services:** ${enabledCount} enabled / ${services.length} registered`;

    return {
      success: true,
      message: text,
      data: {
        text,
        claudeAvailable: claudeStatus.available,
        claudeVersion: claudeStatus.version,
        websocketConnected: Boolean(payload.connected),
        servicesRegistered: services.length,
        servicesEnabled: enabledCount,
      },
    };
  },
};

function parsePayload(payload: unknown): StatusPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  return payload as StatusPayload;
}
