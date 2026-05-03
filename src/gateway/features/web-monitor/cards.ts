export function formatWebMonitorResultMessage(input: {
  success: boolean;
  stdout: string;
  stderr: string;
}): string {
  if (input.success) {
    return input.stdout.trim() || 'Web monitor task completed.';
  }

  return `Web monitor task failed:\n${input.stderr || input.stdout || 'Unknown error'}`;
}

export function createWebMonitorResultCard(input: {
  serviceName: string;
  repo: string;
  success: boolean;
  summary: string;
  tracebackPreview?: string;
  autoPr?: boolean;
  prBaseBranch?: string;
  prDraft?: boolean;
  prBranchPrefix?: string;
}): object {
  const status = input.success ? '修复任务完成' : '修复任务失败';
  const template = input.success ? 'green' : 'red';
  const statusColor = input.success ? 'green' : 'red';

  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: 'Web 服务监控' },
      subtitle: { tag: 'plain_text', content: input.serviceName },
      text_tag_list: [
        {
          tag: 'text_tag',
          text: { tag: 'plain_text', content: input.success ? 'success' : 'failed' },
          color: statusColor,
        },
      ],
      icon: {
        tag: 'standard_icon',
        token: input.success ? 'check-circle_outlined' : 'warning_outlined',
        color: statusColor,
      },
      template,
      padding: '12px',
    },
    config: {
      update_multi: true,
      summary: { content: `${input.serviceName} ${status}` },
    },
    body: {
      elements: [
        {
          tag: 'markdown',
          content: `**${status}**\n\n**服务**：${input.serviceName}\n\n**仓库**：\`${input.repo}\``,
        },
        {
          tag: 'markdown',
          content: `**PR 设置**\n${input.autoPr ? `自动创建 PR · base \`${input.prBaseBranch || 'main'}\` · ${input.prDraft === false ? 'ready' : 'draft'} · branch \`${input.prBranchPrefix || 'oh-my-feishu/web-monitor'}/*\`` : '关闭。此次修复不会自动 push 或创建 PR。'}`,
        },
        {
          tag: 'markdown',
          content: `**Claude Code 结果**\n${truncate(input.summary, 5000)}`,
        },
        ...(input.tracebackPreview ? [{
          tag: 'markdown',
          content: `**Traceback 摘要**\n\`\`\`\n${truncate(input.tracebackPreview, 1200)}\n\`\`\``,
        }] : []),
      ],
    },
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
