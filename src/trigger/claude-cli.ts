import { execa } from 'execa';

export interface ClaudeCliCommandInput {
  args: string[];
  cwd: string;
  timeout?: number;
}

export interface ClaudeCliCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  cwd: string;
}

const ALLOWED_PLUGIN_SUBCOMMANDS = new Set(['list', 'install', 'remove', 'status']);

function validatePluginCommand(args: string[]): string | null {
  const [command, subcommand, nested] = args;
  if (command !== 'plugin' && command !== 'plugins') {
    return '不支持的 Claude 命令。当前只允许 /claude plugin ...';
  }

  if (!subcommand) {
    return '缺少 plugin 子命令。支持 list、install、marketplace add、remove、status。';
  }

  if (subcommand === 'marketplace') {
    return nested === 'add' ? null : '不支持的 plugin 子命令。marketplace 目前只支持 add。';
  }

  if (!ALLOWED_PLUGIN_SUBCOMMANDS.has(subcommand)) {
    return '不支持的 plugin 子命令。支持 list、install、marketplace add、remove、status。';
  }

  return null;
}

export async function runAllowedClaudePluginCommand(input: ClaudeCliCommandInput): Promise<ClaudeCliCommandResult> {
  const args = input.args.filter(Boolean);
  const command = `claude ${args.join(' ')}`;
  const validationError = validatePluginCommand(args);
  if (validationError) {
    return {
      success: false,
      stdout: '',
      stderr: validationError,
      exitCode: 2,
      command,
      cwd: input.cwd,
    };
  }

  try {
    const result = await execa('claude', args, {
      cwd: input.cwd,
      timeout: input.timeout ?? 120000,
      reject: false,
      stdin: 'ignore',
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
      command,
      cwd: input.cwd,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      exitCode: 1,
      command,
      cwd: input.cwd,
    };
  }
}
