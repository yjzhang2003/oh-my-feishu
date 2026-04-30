import type { CommandHandler, CommandContext } from './types.js';
import { createGatewayEvent } from '../../gateway/features/index.js';

export class StatusCommand implements CommandHandler {
  name = '/status';
  description = 'Check system status';

  async execute(ctx: CommandContext): Promise<void> {
    if (!ctx.gatewayFeatureRunner) {
      await ctx.sendText('Gateway feature runner is not configured.');
      return;
    }

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
  }
}
