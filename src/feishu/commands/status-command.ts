import type { CommandHandler, CommandContext } from './types.js';
import { checkClaudeCli } from '../../trigger/invoker.js';
import { listServices } from '../../service/registry.js';
import { env } from '../../config/env.js';
import { createGatewayEvent } from '../../gateway/features/index.js';

export class StatusCommand implements CommandHandler {
  name = '/status';
  description = 'Check system status';

  async execute(ctx: CommandContext): Promise<void> {
    if (ctx.gatewayFeatureRunner) {
      const result = await ctx.gatewayFeatureRunner.run(createGatewayEvent({
        feature: 'status',
        type: 'status.query',
        source: 'feishu',
        chatId: ctx.chatId,
        senderOpenId: ctx.senderOpenId,
        messageId: ctx.messageId,
        payload: {
          connected: ctx.connected,
        },
      }));

      await ctx.sendText(result.message || 'Failed to get status');
      return;
    }

    const claudeStatus = await checkClaudeCli();
    const services = listServices();
    const enabledCount = services.filter(s => s.enabled).length;

    const statusText = `📊 System Status

**Claude CLI:** ${claudeStatus.available ? `✅ ${claudeStatus.version}` : '❌ Not available'}
**WebSocket:** ${ctx.connected ? '✅ Connected' : '❌ Disconnected'}
**GitHub:** ${env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured'}
**Services:** ${enabledCount} enabled / ${services.length} registered`;

    await ctx.sendText(statusText);
  }
}
