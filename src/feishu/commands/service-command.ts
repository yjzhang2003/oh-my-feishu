import type { CommandHandler, CommandContext } from './types.js';
import { createGatewayEvent } from '../../gateway/features/index.js';

export class ServiceCommand implements CommandHandler {
  name = '/service';
  description = 'Manage service registry';

  async execute(ctx: CommandContext): Promise<void> {
    const subCommand = ctx.args[0]?.toLowerCase();

    if (!ctx.gatewayFeatureRunner) {
      await ctx.sendCard({
        title: 'Gateway Unavailable',
        elements: ['Gateway feature runner is not configured.'],
      });
      return;
    }

    const payload = {
      action: (subCommand as 'add' | 'remove' | 'list' | 'enable' | 'disable') || 'help',
      name: ctx.args[1],
      repo: ctx.args[2],
      tracebackUrl: ctx.args[3],
      notifyChatId: ctx.chatId,
      addedBy: ctx.senderOpenId,
    };

    const result = await ctx.gatewayFeatureRunner.run(createGatewayEvent({
      feature: 'service-admin',
      type: 'service.command',
      source: 'feishu',
      chatId: ctx.chatId,
      senderOpenId: ctx.senderOpenId,
      messageId: ctx.messageId,
      payload,
    }));

    const title = String(result.data?.title || (result.success ? 'Service Command Complete' : 'Service Command Failed'));
    const elements = Array.isArray(result.data?.elements)
      ? result.data.elements.map(String)
      : [result.message || 'Unknown result'];

    await ctx.sendCard({
      title: `${result.success ? '✅' : '❌'} ${title}`,
      elements,
    });
  }
}
