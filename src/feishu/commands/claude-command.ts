import { resolve } from 'path';
import type { CommandContext, CommandHandler } from './types.js';
import { env } from '../../config/env.js';
import { runAllowedClaudePluginCommand, type ClaudeCliCommandResult } from '../../trigger/claude-cli.js';

const MAX_OUTPUT_LENGTH = 2500;

function truncate(value: string): string {
  if (!value) return '';
  return value.length > MAX_OUTPUT_LENGTH
    ? `${value.slice(0, MAX_OUTPUT_LENGTH)}\n...（输出已截断）`
    : value;
}

function codeBlock(value: string): string {
  const safe = truncate(value).replace(/```/g, '`\u200b``');
  return `\`\`\`text\n${safe}\n\`\`\``;
}

function usage(): string {
  return [
    '支持的 Claude Plugin 命令：',
    '/claude plugin list',
    '/claude plugin marketplace add <url>',
    '/claude plugin install <name> [--scope project|user]',
  ].join('\n');
}

function createMetaColumn(title: string, value: string, icon: string, color: string): object {
  return {
    tag: 'column',
    width: 'weighted',
    weight: 1,
    vertical_align: 'top',
    elements: [
      {
        tag: 'markdown',
        content: `**${title}**\n${value}`,
        icon: {
          tag: 'standard_icon',
          token: icon,
          color,
        },
      },
    ],
  };
}

function createResultCard(result: ClaudeCliCommandResult): object {
  const elements: object[] = [
    {
      tag: 'column_set',
      flex_mode: 'bisect',
      horizontal_spacing: '12px',
      columns: [
        createMetaColumn(
          '状态',
          `${result.success ? '成功' : '失败'}（exit ${result.exitCode}）`,
          result.success ? 'check_outlined' : 'warning_outlined',
          result.success ? 'green' : 'red'
        ),
        createMetaColumn('执行目录', `\`${result.cwd}\``, 'folder_outlined', 'blue'),
      ],
    },
    {
      tag: 'markdown',
      content: `**命令**\n\`${result.command}\``,
      icon: {
        tag: 'standard_icon',
        token: 'code_outlined',
        color: 'grey',
      },
    },
  ];

  if (result.stdout) {
    elements.push({
      tag: 'markdown',
      content: `**stdout**\n${codeBlock(result.stdout)}`,
    });
  }

  if (result.stderr) {
    elements.push({
      tag: 'markdown',
      content: `**stderr**\n${codeBlock(result.stderr)}`,
    });
  }

  if (!result.stdout && !result.stderr) {
    elements.push({
      tag: 'markdown',
      content: '命令已执行完成，没有输出。',
    });
  }

  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: 'Claude Plugin' },
      subtitle: { tag: 'plain_text', content: 'Claude Code CLI' },
      template: result.success ? 'green' : 'red',
      icon: {
        tag: 'standard_icon',
        token: 'plugin_outlined',
        color: result.success ? 'green' : 'red',
      },
    },
    body: {
      elements,
    },
  };
}

export class ClaudeCommand implements CommandHandler {
  name = '/claude';
  description = 'Run allowed Claude Code plugin commands';

  async execute(ctx: CommandContext): Promise<void> {
    if (ctx.args.length === 0) {
      await ctx.sendText(usage());
      return;
    }

    const cwd = ctx.sessionMode === 'directory' && ctx.sessionDirectory
      ? resolve(ctx.sessionDirectory)
      : resolve(env.REPO_ROOT, 'workspace');

    const result = await runAllowedClaudePluginCommand({
      args: ctx.args,
      cwd,
    });

    await ctx.sendCard(createResultCard(result));
  }
}
