import { describe, expect, it, vi } from 'vitest';
import { StatusCommand } from './status-command.js';

describe('StatusCommand', () => {
  it('sends status as a Card JSON 2.0 card', async () => {
    const sendCard = vi.fn();
    const runner = {
      run: vi.fn().mockResolvedValue({
        success: true,
        message: 'status text',
        data: {
          claudeAvailable: true,
          claudeVersion: '2.1.126',
          websocketConnected: true,
          servicesRegistered: 2,
          servicesEnabled: 1,
        },
      }),
    };

    await new StatusCommand().execute({
      chatId: 'oc_test',
      senderOpenId: 'ou_test',
      chatType: 'group',
      messageId: 'om_test',
      args: [],
      connected: true,
      gatewayFeatureRunner: runner as never,
      sendText: vi.fn(),
      sendCard,
      sendMenuCard: vi.fn(),
    });

    expect(runner.run).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'status',
      type: 'status.query',
      source: 'feishu',
      payload: { connected: true },
    }));
    expect(sendCard).toHaveBeenCalledWith(expect.objectContaining({
      schema: '2.0',
      header: expect.objectContaining({
        title: { tag: 'plain_text', content: 'oh-my-feishu 状态' },
      }),
    }));
  });
});
