import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from './commands/command-registry.js';
import { MessageRouter, type SendMessageFn } from './message-router.js';
import { SessionStore } from './interactions/session-store.js';
import { invokeClaudeChat } from '../trigger/invoker.js';

vi.mock('../trigger/invoker.js', () => ({
  invokeClaudeChat: vi.fn(),
}));

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
  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it('extracts text from Feishu post messages before invoking Claude', async () => {
    vi.mocked(invokeClaudeChat).mockResolvedValueOnce({
      success: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    const sendMessage = createSendMessage();
    const sessionStore = new SessionStore();
    const router = new MessageRouter(new CommandRegistry(), sessionStore, sendMessage);

    await router.handleMessage({
      sender: { sender_type: 'user', sender_id: { open_id: 'ou_test' } },
      message: {
        message_id: 'om_post',
        chat_id: 'oc_test',
        chat_type: 'group',
        message_type: 'post',
        content: JSON.stringify({
          zh_cn: {
            content: [
              [
                { tag: 'text', text: '输出被截断了？' },
                { tag: 'a', text: '我只能看到', href: 'https://example.com' },
              ],
              [
                { tag: 'at', user_name: '张三' },
                { tag: 'text', text: ' 后面就看不到了' },
              ],
            ],
          },
        }),
      },
    });

    await vi.waitFor(() => {
      expect(invokeClaudeChat).toHaveBeenCalled();
    });
    expect(vi.mocked(invokeClaudeChat).mock.calls[0][0].message).toBe(
      '输出被截断了？我只能看到\n@张三 后面就看不到了'
    );
    sessionStore.destroy();
  });

  it('asks the user to resend when extracted message text is empty', async () => {
    const sendMessage = createSendMessage();
    const sessionStore = new SessionStore();
    const router = new MessageRouter(new CommandRegistry(), sessionStore, sendMessage);

    await router.handleMessage({
      sender: { sender_type: 'user', sender_id: { open_id: 'ou_test' } },
      message: {
        message_id: 'om_empty',
        chat_id: 'oc_test',
        chat_type: 'group',
        message_type: 'post',
        content: JSON.stringify({ zh_cn: { content: [[{ tag: 'img', image_key: 'img_test' }]] } }),
      },
    });

    expect(invokeClaudeChat).not.toHaveBeenCalled();
    expect(sendMessage.sendTextMessage).toHaveBeenCalledWith(
      'oc_test',
      expect.stringContaining('没能读取到这条消息的文字内容')
    );
    sessionStore.destroy();
  });

  it('renders final result text when Claude returns no streaming deltas', async () => {
    vi.mocked(invokeClaudeChat).mockResolvedValueOnce({
      success: true,
      stdout: [
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: '完整回答' }] },
        }),
        JSON.stringify({ type: 'result', result: '完整回答' }),
      ].join('\n'),
      stderr: '',
      exitCode: 0,
    });
    const sendMessage = { ...createSendMessage(), sendCardById: vi.fn() };
    const cardKit = {
      createCard: vi.fn().mockResolvedValue('card_1'),
      deleteCardElements: vi.fn().mockResolvedValue(true),
      addCardElements: vi.fn().mockResolvedValue(true),
      updateCardContent: vi.fn().mockResolvedValue(true),
      updateCardProps: vi.fn().mockResolvedValue(true),
      updateCardSettings: vi.fn().mockResolvedValue(true),
    };
    const sessionStore = new SessionStore();
    const router = new MessageRouter(new CommandRegistry(), sessionStore, sendMessage, cardKit as any);

    await router.handleMessage({
      sender: { sender_type: 'user', sender_id: { open_id: 'ou_test' } },
      message: {
        message_id: 'om_chat',
        chat_id: 'oc_test',
        chat_type: 'group',
        content: JSON.stringify({ text: '你好' }),
      },
    });

    await vi.waitFor(() => {
      expect(cardKit.updateCardContent).toHaveBeenCalledWith('card_1', expect.any(String), '完整回答', expect.any(Number));
    });
    await vi.waitFor(() => {
      expect(cardKit.updateCardProps).toHaveBeenCalledWith(
        'card_1',
        'status_tag',
        { text: { tag: 'plain_text', content: '已完成' }, color: 'green' },
        expect.any(Number)
      );
    });
    sessionStore.destroy();
  });
});
