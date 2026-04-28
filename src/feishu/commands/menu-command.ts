import type { CommandHandler, CommandContext } from './types.js';

export class MenuCommand implements CommandHandler {
  name = '/menu';
  aliases = [];
  description = 'Show interactive menu';

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.sendMenuCard();
  }
}
