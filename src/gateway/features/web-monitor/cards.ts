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

function codeBlock(content: string): string {
  return `\`\`\`text\n${content.replace(/```/g, '`​``')}\n\`\`\``;
}

function displayBox(options: {
  title: string;
  content: string;
  icon: string;
  color: string;
}): object {
  return {
    tag: 'interactive_container',
    width: 'fill',
    direction: 'vertical',
    vertical_spacing: '6px',
    background_style: 'default',
    has_border: true,
    border_color: options.color,
    corner_radius: '10px',
    padding: '10px 12px 10px 12px',
    disabled: true,
    elements: [
      {
        tag: 'markdown',
        content: `**${options.title}**`,
        icon: {
          tag: 'standard_icon',
          token: options.icon,
          color: options.color,
        },
      },
      {
        tag: 'markdown',
        content: options.content,
      },
    ],
  };
}

import type { ParsedRepairResult } from './feature.js';

export function createWebMonitorResultCard(input: {
  serviceName: string;
  repo: string;
  success: boolean;
  summary: ParsedRepairResult;
  tracebackPreview?: string;
  autoPr?: boolean;
  prBaseBranch?: string;
  prDraft?: boolean;
  prBranchPrefix?: string;
}): object {
  const status = input.success ? '修复完成' : '修复失败';
  const template = input.success ? 'green' : 'red';
  const statusColor = input.success ? 'green' : 'red';

  const prConfig = input.autoPr
    ? `自动创建 PR\nbase: \`${input.prBaseBranch || 'main'}\`\nmode: ${input.prDraft === false ? 'ready' : 'draft'}\nbranch: \`${input.prBranchPrefix || 'oh-my-feishu/web-monitor'}/*\``
    : '关闭。此次修复不会自动 push 或创建 PR。';

  const elements: object[] = [
    displayBox({
      title: '服务',
      content: `${input.serviceName}\n\`${input.repo}\``,
      icon: 'folder_outlined',
      color: statusColor,
    }),
    displayBox({
      title: '根本原因',
      content: truncate(input.summary.rootCause, 1500),
      icon: 'search_outlined',
      color: statusColor,
    }),
    displayBox({
      title: '代码变更',
      content: truncate(input.summary.changes, 2000),
      icon: 'edit_outlined',
      color: 'blue',
    }),
    displayBox({
      title: '验证结果',
      content: truncate(input.summary.verification, 1000),
      icon: 'check_outlined',
      color: input.summary.status === 'success' ? 'green' : 'orange',
    }),
  ];

  // PR info box
  if (input.summary.pr && input.summary.pr !== '未创建' && input.summary.pr !== '无法解析') {
    elements.push(
      displayBox({
        title: 'Pull Request',
        content: truncate(input.summary.pr, 500),
        icon: 'git_branch_outlined',
        color: 'green',
      })
    );
  }

  // Follow-up if present
  if (input.summary.followUp && input.summary.followUp !== '无' && input.summary.followUp !== '无法解析') {
    elements.push(
      displayBox({
        title: '后续操作',
        content: truncate(input.summary.followUp, 1000),
        icon: 'alert_outlined',
        color: 'orange',
      })
    );
  }

  // PR settings
  elements.push(
    displayBox({
      title: 'PR 设置',
      content: prConfig,
      icon: 'command_outlined',
      color: input.autoPr ? 'green' : 'grey',
    })
  );

  // Traceback preview at the end
  if (input.tracebackPreview) {
    elements.push(
      displayBox({
        title: 'Traceback 摘要',
        content: codeBlock(truncate(input.tracebackPreview, 800)),
        icon: 'doc-search_outlined',
        color: 'grey',
      })
    );
  }

  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: 'Web 服务监控' },
      subtitle: { tag: 'plain_text', content: input.serviceName },
      text_tag_list: [
        {
          tag: 'text_tag',
          text: { tag: 'plain_text', content: input.summary.status },
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
      elements,
    },
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

export function createTracebackDetectedCard(input: {
  serviceName: string;
  repo: string;
  tracebackPreview: string;
  eventId: string;
}): object {
  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: '发现新问题' },
      subtitle: { tag: 'plain_text', content: input.serviceName },
      text_tag_list: [
        {
          tag: 'text_tag',
          text: { tag: 'plain_text', content: 'pending' },
          color: 'orange',
        },
      ],
      icon: {
        tag: 'standard_icon',
        token: 'warning_outlined',
        color: 'orange',
      },
      template: 'orange',
      padding: '12px',
    },
    config: {
      update_multi: true,
      summary: { content: `${input.serviceName} 发现新问题` },
    },
    body: {
      elements: [
        displayBox({
          title: '服务',
          content: `${input.serviceName}\n\`${input.repo}\``,
          icon: 'folder_outlined',
          color: 'orange',
        }),
        displayBox({
          title: 'Traceback 预览',
          content: codeBlock(truncate(input.tracebackPreview, 1000)),
          icon: 'doc-search_outlined',
          color: 'orange',
        }),
        {
          tag: 'markdown',
          content: '检测到新的 traceback。点击下方按钮开始分析并生成修复计划。',
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '开始分析' },
          type: 'primary',
          width: 'default',
          behaviors: [
            {
              type: 'callback',
              value: {
                action: 'web-monitor-analyze',
                serviceName: input.serviceName,
                eventId: input.eventId,
              },
            },
          ],
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '忽略' },
          type: 'default',
          width: 'default',
          behaviors: [
            {
              type: 'callback',
              value: {
                action: 'web-monitor-skip',
                serviceName: input.serviceName,
                eventId: input.eventId,
              },
            },
          ],
        },
      ],
    },
  };
}

export function createRepairConfirmCard(input: {
  serviceName: string;
  repo: string;
  analysisResult: string;
  eventId: string;
  autoPr?: boolean;
  prBaseBranch?: string;
  prDraft?: boolean;
}): object {
  const prInfo = input.autoPr
    ? `修复后将自动创建 PR（base: \`${input.prBaseBranch || 'main'}\`，mode: ${input.prDraft === false ? 'ready' : 'draft'}）`
    : '修复后只保留本地改动，不会自动提交 PR。';

  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: '修复确认' },
      subtitle: { tag: 'plain_text', content: input.serviceName },
      text_tag_list: [
        {
          tag: 'text_tag',
          text: { tag: 'plain_text', content: 'confirm' },
          color: 'blue',
        },
      ],
      icon: {
        tag: 'standard_icon',
        token: 'confirm_outlined',
        color: 'blue',
      },
      template: 'blue',
      padding: '12px',
    },
    config: {
      update_multi: true,
      summary: { content: `${input.serviceName} 等待修复确认` },
    },
    body: {
      elements: [
        displayBox({
          title: '服务',
          content: `${input.serviceName}\n\`${input.repo}\``,
          icon: 'folder_outlined',
          color: 'blue',
        }),
        displayBox({
          title: '分析结果',
          content: truncate(input.analysisResult, 3000),
          icon: 'robot_outlined',
          color: 'blue',
        }),
        {
          tag: 'markdown',
          content: `**PR 设置**：${prInfo}`,
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '确认修复' },
          type: 'primary',
          width: 'default',
          behaviors: [
            {
              type: 'callback',
              value: {
                action: 'web-monitor-confirm-repair',
                serviceName: input.serviceName,
                eventId: input.eventId,
              },
            },
          ],
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '跳过' },
          type: 'default',
          width: 'default',
          behaviors: [
            {
              type: 'callback',
              value: {
                action: 'web-monitor-skip',
                serviceName: input.serviceName,
                eventId: input.eventId,
              },
            },
          ],
        },
      ],
    },
  };
}
