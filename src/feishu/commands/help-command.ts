import type { CommandHandler, CommandContext } from './types.js';

export class HelpCommand implements CommandHandler {
  name = '/help';
  description = 'Show this help message';

  async execute(ctx: CommandContext): Promise<void> {
    const helpText = `oh-my-feishu Commands

/repair [context] - Start auto-repair with optional context
/service add <name> <owner/repo> <traceback_url> - Register a service
/service remove <name> - Remove a service
/service list - List registered services
/service enable <name> - Enable service monitoring
/service disable <name> - Disable service monitoring
/status - Check system status
/help - Show this help message

Or just send a message to chat with Claude Code!`;

    await ctx.sendText(helpText);
  }
}
