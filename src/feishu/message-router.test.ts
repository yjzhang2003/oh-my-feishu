import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from './commands/command-registry.js';
import { MessageRouter, type SendMessageFn } from './message-router.js';
import { SessionStore } from './interactions/session-store.js';

function createSendMessage(): SendMessageFn {
  return {
    sendTextMessage: vi.fn(),
    sendCardMessage: vi.fn(),
    sendMenuCard: vi.fn(),
    sendAckReaction: vi.fn().mockResolvedValue(undefined),
    sendCompletionReaction: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
  };
}

describe('MessageRouter commands', () => {
  it('reports unknown slash commands to the user', async () => {
    const sendMessage = createSendMessage();
    const sessionStore = new SessionStore();
    const router = new MessageRouter(new CommandRegistry(), sessionStore, sendMessage);

    await router.handleMessage({
      sender: { sender_type: 'user', sender_id: { open_id: 'ou_test' } },
      message: {
        message_id: 'om_test',
        chat_id: 'oc_test',
        chat_type: 'group',
        content: JSON.stringify({ text: '/not-a-command test' }),
      },
    });

    expect(sendMessage.sendAckReaction).toHaveBeenCalledWith('om_test');
    expect(sendMessage.sendTextMessage).toHaveBeenCalledWith(
      'oc_test',
      expect.stringContaining('未知命令：/not-a-command')
    );
    sessionStore.destroy();
  });
});
