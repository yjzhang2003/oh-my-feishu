import type { CommandHandler, CommandContext } from './types.js';
import { addService, removeService, listServices, updateService } from '../../service/registry.js';
import { log } from '../../utils/logger.js';
import { createGatewayEvent } from '../../gateway/features/index.js';

export class ServiceCommand implements CommandHandler {
  name = '/service';
  description = 'Manage service registry';

  async execute(ctx: CommandContext): Promise<void> {
    const subCommand = ctx.args[0]?.toLowerCase();

    if (ctx.gatewayFeatureRunner) {
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
      return;
    }

    switch (subCommand) {
      case 'add': {
        const [,, name, repo, tracebackUrl] = ctx.args;
        if (!name || !repo || !tracebackUrl) {
          await ctx.sendCard({
            title: '❌ Invalid /service add',
            elements: ['Usage: `/service add <name> <owner/repo> <traceback_url>`'],
          });
          return;
        }

        // Validate repo format: owner/repo
        if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
          await ctx.sendCard({
            title: '❌ Invalid repo format',
            elements: ['Repo must be in `owner/repo` format (e.g. `myorg/my-api`)'],
          });
          return;
        }

        // Validate URL format
        if (!/^https?:\/\/.+/.test(tracebackUrl)) {
          await ctx.sendCard({
            title: '❌ Invalid URL',
            elements: ['Traceback URL must start with `http://` or `https://`'],
          });
          return;
        }

        const [githubOwner, githubRepo] = repo.split('/');

        try {
          addService({
            name,
            githubOwner,
            githubRepo,
            tracebackUrl,
            notifyChatId: ctx.chatId,
            tracebackUrlType: 'json',
            enabled: true,
            addedAt: new Date().toISOString(),
            addedBy: ctx.senderOpenId,
          });

          await ctx.sendCard({
            title: '✅ Service Registered',
            elements: [
              `**Name:** ${name}`,
              `**Repo:** ${repo}`,
              `**Traceback URL:** ${tracebackUrl}`,
              `**Notify chat:** ${ctx.chatId}`,
              '',
              'TracebackMonitor will poll this service for new errors.',
            ],
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          await ctx.sendCard({
            title: '❌ Failed to add service',
            elements: [msg],
          });
        }
        break;
      }

      case 'remove': {
        const name = ctx.args[2];
        if (!name) {
          await ctx.sendCard({
            title: '❌ Invalid /service remove',
            elements: ['Usage: `/service remove <name>`'],
          });
          return;
        }

        const removed = removeService(name);
        await ctx.sendCard({
          title: removed ? '✅ Service Removed' : '❌ Service Not Found',
          elements: [removed ? `Service "${name}" has been removed.` : `Service "${name}" is not registered.`],
        });
        break;
      }

      case 'list': {
        const services = listServices();
        if (services.length === 0) {
          await ctx.sendCard({
            title: '📋 Service Registry',
            elements: ['No services registered. Use `/service add` to register one.'],
          });
          return;
        }

        const serviceLines = services.map(s =>
          `- **${s.name}** \`${s.githubOwner}/${s.githubRepo}\` ${s.enabled ? '🟢' : '🔴'} ${s.lastCheckedAt ? `last: ${s.lastCheckedAt}` : ''}`
        );

        await ctx.sendCard({
          title: `📋 Service Registry (${services.length})`,
          elements: serviceLines,
        });
        break;
      }

      case 'enable':
      case 'disable': {
        const name = ctx.args[2];
        if (!name) {
          await ctx.sendCard({
            title: `❌ Invalid /service ${subCommand}`,
            elements: [`Usage: \`/service ${subCommand} <name>\``],
          });
          return;
        }

        const updated = updateService(name, { enabled: subCommand === 'enable' });
        if (updated) {
          await ctx.sendCard({
            title: `✅ Service ${subCommand === 'enable' ? 'Enabled' : 'Disabled'}`,
            elements: [`Service "${name}" is now ${subCommand === 'enable' ? 'enabled' : 'disabled'}.`],
          });
        } else {
          await ctx.sendCard({
            title: '❌ Service Not Found',
            elements: [`Service "${name}" is not registered.`],
          });
        }
        break;
      }

      default:
        await ctx.sendCard({
          title: '📋 Service Commands',
          elements: [
            '`/service add <name> <owner/repo> <traceback_url>`',
            '`/service remove <name>`',
            '`/service list`',
            '`/service enable <name>`',
            '`/service disable <name>`',
          ],
        });
    }
  }
}
