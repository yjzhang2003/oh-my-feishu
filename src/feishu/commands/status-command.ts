import type { CommandHandler, CommandContext } from './types.js';
import { checkClaudeCli } from '../../trigger/invoker.js';
import { listServices } from '../../service/registry.js';
import { env } from '../../config/env.js';

export class StatusCommand implements CommandHandler {
  name = '/status';
  description = 'Check system status';

  async execute(ctx: CommandContext): Promise<void> {
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
