import type { CommandHandler, CommandContext } from './types.js';
import { createGatewayEvent } from '../../gateway/features/index.js';

interface StatusCardData {
  claudeAvailable?: boolean;
  claudeVersion?: string;
  websocketConnected?: boolean;
  servicesRegistered?: number;
  servicesEnabled?: number;
}

function boolStatus(available: boolean | undefined): string {
  return available ? '正常' : '异常';
}

function createStatusCard(data: StatusCardData, fallbackMessage: string): object {
  const claudeAvailable = Boolean(data.claudeAvailable);
  const websocketConnected = Boolean(data.websocketConnected);
  const servicesRegistered = data.servicesRegistered ?? 0;
  const servicesEnabled = data.servicesEnabled ?? 0;
  const healthy = claudeAvailable && websocketConnected;

  const statusItems = [
    {
      title: 'Claude Code',
      value: claudeAvailable ? data.claudeVersion || 'Available' : 'Not available',
      icon: 'code_outlined',
      color: claudeAvailable ? 'green' : 'red',
    },
    {
      title: '飞书 WebSocket',
      value: boolStatus(websocketConnected),
      icon: 'connect_outlined',
      color: websocketConnected ? 'green' : 'red',
    },
    {
      title: 'Gateway 服务',
      value: `${servicesEnabled} enabled / ${servicesRegistered} registered`,
      icon: 'status-meeting_outlined',
      color: servicesEnabled > 0 ? 'green' : 'grey',
    },
  ];

  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: 'oh-my-feishu 状态' },
      subtitle: { tag: 'plain_text', content: healthy ? '核心组件运行正常' : '有组件需要检查' },
      template: healthy ? 'green' : 'red',
      icon: {
        tag: 'standard_icon',
        token: healthy ? 'check_outlined' : 'warning_outlined',
        color: healthy ? 'green' : 'red',
      },
    },
    body: {
      elements: [
        {
          tag: 'column_set',
          flex_mode: 'bisect',
          horizontal_spacing: '12px',
          columns: statusItems.slice(0, 2).map((item) => ({
            tag: 'column',
            width: 'weighted',
            weight: 1,
            vertical_align: 'top',
            elements: [
              {
                tag: 'markdown',
                content: `**${item.title}**\n${item.value}`,
                icon: {
                  tag: 'standard_icon',
                  token: item.icon,
                  color: item.color,
                },
              },
            ],
          })),
        },
        {
          tag: 'markdown',
          content: `**${statusItems[2].title}**\n${statusItems[2].value}`,
          icon: {
            tag: 'standard_icon',
            token: statusItems[2].icon,
            color: statusItems[2].color,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'markdown',
          content: fallbackMessage,
        },
      ],
    },
  };
}

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

    if (!result.success) {
      await ctx.sendText(result.message || 'Failed to get status');
      return;
    }

    await ctx.sendCard(createStatusCard(
      (result.data || {}) as StatusCardData,
      result.message || 'Status query completed.'
    ));
  }
}
