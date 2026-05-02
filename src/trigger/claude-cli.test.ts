import { describe, expect, it, vi, afterEach } from 'vitest';
import { execa } from 'execa';

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: 'plugin output',
    stderr: '',
  }),
}));

describe('runAllowedClaudePluginCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs allowed claude plugin commands in the provided cwd', async () => {
    const { runAllowedClaudePluginCommand } = await import('./claude-cli.js');

    const result = await runAllowedClaudePluginCommand({
      args: ['plugin', 'install', 'oh-my-feishu@marketplace', '--scope', 'project'],
      cwd: '/tmp/project',
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('plugin output');
    expect(execa).toHaveBeenCalledWith('claude', [
      'plugin',
      'install',
      'oh-my-feishu@marketplace',
      '--scope',
      'project',
    ], expect.objectContaining({
      cwd: '/tmp/project',
      reject: false,
      stdin: 'ignore',
    }));
  });

  it('allows plugin marketplace add', async () => {
    const { runAllowedClaudePluginCommand } = await import('./claude-cli.js');

    const result = await runAllowedClaudePluginCommand({
      args: ['plugin', 'marketplace', 'add', 'https://github.com/example/plugins'],
      cwd: '/tmp/project',
    });

    expect(result.success).toBe(true);
    expect(execa).toHaveBeenCalledTimes(1);
  });

  it('allows the native plural plugins alias', async () => {
    const { runAllowedClaudePluginCommand } = await import('./claude-cli.js');

    const result = await runAllowedClaudePluginCommand({
      args: ['plugins', 'install', 'example-plugin'],
      cwd: '/tmp/project',
    });

    expect(result.success).toBe(true);
    expect(execa).toHaveBeenCalledWith('claude', ['plugins', 'install', 'example-plugin'], expect.any(Object));
  });

  it('rejects non-plugin claude commands', async () => {
    const { runAllowedClaudePluginCommand } = await import('./claude-cli.js');

    const result = await runAllowedClaudePluginCommand({
      args: ['auth', 'login'],
      cwd: '/tmp/project',
    });

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('不支持的 Claude 命令');
    expect(execa).not.toHaveBeenCalled();
  });

  it('rejects unsupported plugin subcommands', async () => {
    const { runAllowedClaudePluginCommand } = await import('./claude-cli.js');

    const result = await runAllowedClaudePluginCommand({
      args: ['plugin', 'publish'],
      cwd: '/tmp/project',
    });

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('不支持的 plugin 子命令');
    expect(execa).not.toHaveBeenCalled();
  });
});
