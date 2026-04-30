import type { CommandHandler, CommandContext } from './types.js';
import { log } from '../../utils/logger.js';
import { createGatewayEvent } from '../../gateway/features/index.js';

export class RepairCommand implements CommandHandler {
  name = '/repair';
  aliases = ['/fix'];
  description = 'Start auto-repair with optional context';

  async execute(ctx: CommandContext): Promise<void> {
    const context = ctx.args.join(' ').trim() || 'Repair requested';
    log.command(ctx.chatId, '/repair', context);

    if (!ctx.gatewayFeatureRunner) {
      await ctx.sendCard({
        title: 'Gateway Unavailable',
        elements: ['Gateway feature runner is not configured.'],
      });
      return;
    }

    await ctx.sendCard({
      title: '🔄 Auto Repair Started',
      elements: [
        `**Context:** ${context}`,
        'Analyzing the issue...',
      ],
    });

    const result = await ctx.gatewayFeatureRunner.run(createGatewayEvent({
      feature: 'repair',
      type: 'repair.requested',
      source: 'feishu',
      chatId: ctx.chatId,
      senderOpenId: ctx.senderOpenId,
      messageId: ctx.messageId,
      payload: {
        context,
        chatId: ctx.chatId,
        senderOpenId: ctx.senderOpenId,
      },
    }));

    if (result.success) {
      await ctx.sendCard({
        title: '✅ Repair Complete',
        elements: [result.message || 'The repair has been completed successfully.'],
      });
    } else {
      await ctx.sendCard({
        title: '❌ Repair Failed',
        elements: [`\`\`\`\n${result.message || 'Unknown error'}\n\`\`\``],
      });
    }
  }
}
