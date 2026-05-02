import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolve } from 'path';
import { ClaudeCommand } from './claude-command.js';
import { runAllowedClaudePluginCommand } from '../../trigger/claude-cli.js';

vi.mock('../../trigger/claude-cli.js', () => ({
  runAllowedClaudePluginCommand: vi.fn().mockResolvedValue({
    success: true,
    stdout: 'plugin list',
    stderr: '',
    exitCode: 0,
    command: 'claude plugin list',
    cwd: '/tmp/project',
  }),
}));

describe('ClaudeCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs claude plugin commands in the active directory session cwd', async () => {
    const sendCard = vi.fn();
    const command = new ClaudeCommand();

    await command.execute({
      chatId: 'oc_test',
      senderOpenId: 'ou_test',
      chatType: 'group',
      messageId: 'om_test',
      args: ['plugin', 'list'],
      sessionMode: 'directory',
      sessionDirectory: '/tmp/project',
      sendText: vi.fn(),
      sendCard,
      sendMenuCard: vi.fn(),
    });

    expect(runAllowedClaudePluginCommand).toHaveBeenCalledWith({
      args: ['plugin', 'list'],
      cwd: '/tmp/project',
    });
    expect(sendCard).toHaveBeenCalledWith(expect.objectContaining({
      schema: '2.0',
      header: expect.objectContaining({
        title: { tag: 'plain_text', content: 'Claude Plugin' },
      }),
      body: expect.objectContaining({
        elements: expect.arrayContaining([
          expect.objectContaining({
            tag: 'markdown',
            content: expect.stringContaining('plugin list'),
          }),
        ]),
      }),
    }));
  });

  it('runs direct chat claude plugin commands in workspace cwd', async () => {
    const command = new ClaudeCommand();

    await command.execute({
      chatId: 'oc_test',
      senderOpenId: 'ou_test',
      chatType: 'group',
      messageId: 'om_test',
      args: ['plugin', 'list'],
      sessionMode: 'direct',
      sendText: vi.fn(),
      sendCard: vi.fn(),
      sendMenuCard: vi.fn(),
    });

    expect(runAllowedClaudePluginCommand).toHaveBeenCalledWith({
      args: ['plugin', 'list'],
      cwd: resolve(process.cwd(), 'workspace'),
    });
  });

  it('shows usage when no subcommand is provided', async () => {
    const sendText = vi.fn();
    const command = new ClaudeCommand();

    await command.execute({
      chatId: 'oc_test',
      senderOpenId: 'ou_test',
      chatType: 'group',
      messageId: 'om_test',
      args: [],
      sessionMode: 'direct',
      sendText,
      sendCard: vi.fn(),
      sendMenuCard: vi.fn(),
    });

    expect(sendText).toHaveBeenCalledWith(expect.stringContaining('/claude plugin list'));
    expect(runAllowedClaudePluginCommand).not.toHaveBeenCalled();
  });
});
