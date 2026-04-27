import type { CommandHandler, CommandContext } from './types.js';
import { writeTrigger } from '../../trigger/trigger.js';
import { invokeClaudeSkill } from '../../trigger/invoker.js';
import { log } from '../../utils/logger.js';

export class RepairCommand implements CommandHandler {
  name = '/repair';
  aliases = ['/fix'];
  description = 'Start auto-repair with optional context';

  async execute(ctx: CommandContext): Promise<void> {
    const context = ctx.args.join(' ').trim() || 'Repair requested';
    log.command(ctx.chatId, '/repair', context);

    // Send acknowledgment
    await ctx.sendCard({
      title: '🔄 Auto Repair Started',
      elements: [
        `**Context:** ${context}`,
        'Analyzing the issue...',
      ],
    });

    // Write trigger
    writeTrigger({
      context,
      source: 'feishu',
      timestamp: new Date().toISOString(),
      metadata: {
        chat_id: ctx.chatId,
        sender_open_id: ctx.senderOpenId,
      },
    });

    // Invoke skill asynchronously
    log.skill('auto-repair', 'start', { chatId: ctx.chatId, context });
    invokeClaudeSkill({ skill: 'auto-repair' })
      .then(async (result) => {
        if (result.success) {
          log.skill('auto-repair', 'success', { chatId: ctx.chatId });
          await ctx.sendCard({
            title: '✅ Repair Complete',
            elements: ['The repair has been completed successfully.'],
          });
        } else {
          log.skill('auto-repair', 'error', { chatId: ctx.chatId, error: result.stderr });
          await ctx.sendCard({
            title: '❌ Repair Failed',
            elements: [`\`\`\`\n${result.stderr || 'Unknown error'}\n\`\`\``],
          });
        }
      })
      .catch((error) => {
        log.error('feishu', 'Repair command failed', { error: String(error) });
      });
  }
}
