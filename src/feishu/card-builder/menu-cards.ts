/**
 * Menu card builders for 3-level hierarchical navigation
 * Generates Feishu Card JSON 2.0 for cardkit batch_update support
 */

import type { HistoryEntry } from '../interactions/session-history-store.js';
import { listServices, type ServiceEntry } from '../../service/registry.js';

export interface CardBuildResult {
  card: object;
  elementIds: string[];
}

type CardV2Element = Record<string, unknown>;

function md(content: string): CardV2Element {
  return { tag: 'markdown', content };
}

function iconMd(content: string, token: string, color: string): CardV2Element {
  return {
    tag: 'markdown',
    content,
    icon: {
      tag: 'standard_icon',
      token,
      color,
    },
  };
}

function interactiveCard(options: {
  title: string;
  description: string;
  icon: string;
  color: string;
  action: string;
  background?: string;
}): CardV2Element {
  return {
    tag: 'interactive_container',
    width: 'fill',
    direction: 'vertical',
    vertical_spacing: '4px',
    background_style: options.background || 'default',
    has_border: true,
    border_color: options.color,
    corner_radius: '10px',
    padding: '10px 12px 10px 12px',
    hover_tips: {
      tag: 'plain_text',
      content: `打开${options.title}`,
    },
    behaviors: [
      {
        type: 'callback',
        value: { action: options.action },
      },
    ],
    elements: [
      iconMd(`**${options.title}**`, options.icon, options.color),
      md(options.description),
    ],
  };
}

function sessionOptionCard(options: {
  title: string;
  description: string;
  icon: string;
  color: string;
  action: string;
}): CardV2Element {
  return {
    tag: 'interactive_container',
    width: 'fill',
    direction: 'vertical',
    vertical_spacing: '4px',
    background_style: 'default',
    has_border: true,
    border_color: options.color,
    corner_radius: '10px',
    padding: '10px 12px 10px 12px',
    hover_tips: {
      tag: 'plain_text',
      content: options.title,
    },
    behaviors: [
      {
        type: 'callback',
        value: { action: options.action },
      },
    ],
    elements: [
      iconMd(`**${options.title}**`, options.icon, options.color),
      md(options.description),
    ],
  };
}

function displayBox(options: {
  title: string;
  content: string;
  icon: string;
  color: string;
}): CardV2Element {
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
      iconMd(`**${options.title}**`, options.icon, options.color),
      md(options.content),
    ],
  };
}

function columnSet(columns: CardV2Element[][]): CardV2Element {
  return {
    tag: 'column_set',
    flex_mode: 'bisect',
    horizontal_spacing: '12px',
    horizontal_align: 'left',
    margin: '4px 0px 4px 0px',
    columns: columns.map((elements) => ({
      tag: 'column',
      width: 'weighted',
      weight: 1,
      vertical_align: 'top',
      vertical_spacing: '8px',
      elements,
    })),
  };
}

function commandTable(): CardV2Element {
  return {
    tag: 'table',
    page_size: 7,
    row_height: 'low',
    margin: '4px 0px 0px 0px',
    header_style: {
      text_align: 'left',
      text_size: 'normal',
      background_style: 'grey',
      text_color: 'grey',
      bold: true,
      lines: 1,
    },
    columns: [
      { name: 'command', display_name: '命令', data_type: 'lark_md', width: '56%' },
      { name: 'usage', display_name: '用途', data_type: 'text', width: '44%' },
    ],
    rows: [
      { command: '`/menu`', usage: '打开菜单' },
      { command: '`/status`', usage: '查看运行状态' },
      { command: '`/service list`', usage: '查看监控服务' },
      { command: '`/service add <name> <owner/repo> <url>`', usage: '注册监控服务' },
      { command: '`/service enable <name>`', usage: '启用监控服务' },
      { command: '`/service disable <name>`', usage: '停用监控服务' },
      { command: '`/repair <context>`', usage: '触发后台修复流程' },
      { command: '`/claude plugin list`', usage: '查看 Claude Code 插件' },
      { command: '`/claude plugin marketplace add <url>`', usage: '添加插件市场' },
      { command: '`/claude plugin install <name>`', usage: '安装插件' },
    ],
  };
}

function historyEntryTitle(entry: HistoryEntry): string {
  return entry.directory.split('/').filter(Boolean).pop() || entry.directory;
}

function codeBlock(content: string): string {
  return `\`\`\`text\n${content.replace(/```/g, '`\u200b``')}\n\`\`\``;
}

interface CallbackButton {
  text: string;
  action: string;
}

function createCardV2(options: {
  title?: string;
  subtitle?: string;
  template?: string;
  tags?: { text: string; color: string }[];
  icon?: { token: string; color?: string };
  elements: CardV2Element[];
  buttons?: CallbackButton[];
}): CardBuildResult {
  let idCounter = 0;
  const genId = (prefix: string) => `${prefix}_${++idCounter}`;
  const elementIds: string[] = [];
  const bodyElements: object[] = [];

  for (const el of options.elements) {
    const id = genId('el');
    elementIds.push(id);
    const element = { ...el };
    if (!element.element_id) {
      element.element_id = id;
    }
    bodyElements.push(element);
  }

  if (options.buttons && options.buttons.length > 0) {
    // Add hr before buttons
    const hrId = genId('hr');
    elementIds.push(hrId);
    bodyElements.push({ tag: 'hr', element_id: hrId });

    // Buttons in 2.0 are standalone body elements with behaviors array
    for (const btn of options.buttons) {
      const btnId = genId('btn');
      elementIds.push(btnId);
      bodyElements.push({
        tag: 'button',
        element_id: btnId,
        text: { tag: 'plain_text', content: btn.text },
        type: btn.action.includes('delete') ? 'danger' : btn.action.includes('new') || btn.action.includes('resume') ? 'primary' : 'default',
        width: 'default',
        size: 'medium',
        behaviors: [
          {
            type: 'callback',
            value: { action: btn.action },
          },
        ],
      });
    }
  }

  const card: object = {
    schema: '2.0',
    header: {
      title: {
        content: options.title || 'oh-my-feishu',
        tag: 'plain_text',
      },
      ...(options.subtitle ? { subtitle: { content: options.subtitle, tag: 'plain_text' } } : {}),
      ...(options.tags
        ? {
          text_tag_list: options.tags.map((tag, index) => ({
            tag: 'text_tag',
            element_id: `tag_${index + 1}`,
            text: { tag: 'plain_text', content: tag.text },
            color: tag.color,
          })),
        }
        : {}),
      ...(options.icon
        ? {
          icon: {
            tag: 'standard_icon',
            token: options.icon.token,
            color: options.icon.color,
          },
        }
        : {}),
      template: options.template || 'wathet',
      padding: '12px',
    },
    config: {
      update_multi: true,
      summary: {
        content: options.title || 'oh-my-feishu',
      },
    },
    body: {
      elements: bodyElements,
    },
  };

  return { card, elementIds };
}

/** Format relative time from ISO timestamp */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

/** Level 1: Main Menu */
export function createMainMenuCard(): CardBuildResult {
  return createCardV2({
    title: 'oh-my-feishu',
    subtitle: 'Claude Code on Feishu',
    template: 'turquoise',
    icon: { token: 'chatbox_outlined', color: 'turquoise' },
    tags: [
      { text: 'menu', color: 'turquoise' },
      { text: 'interactive', color: 'blue' },
    ],
    elements: [
      md('这里是菜单！发送 `/menu`即可调出菜单。'),
      columnSet([
        [
          interactiveCard({
            title: '新建会话',
            description: '开始聊天或绑定项目目录。',
            icon: 'add_outlined',
            color: 'blue',
            action: 'menu:new',
          }),
        ],
        [
          interactiveCard({
            title: '历史会话',
            description: '继续最近的目录会话。',
            icon: 'history_outlined',
            color: 'indigo',
            action: 'menu:history',
          }),
        ],
      ]),
      columnSet([
        [
          interactiveCard({
            title: '自动化技能',
            description: '管理后台自动处理能力。',
            icon: 'robot_outlined',
            color: 'green',
            action: 'menu:gateway',
          }),
        ],
        [
          interactiveCard({
            title: '指令菜单',
            description: '查看可用指令。',
            icon: 'command_outlined',
            color: 'orange',
            action: 'menu:commands',
          }),
        ],
      ]),
    ],
  });
}

/** Level 2: Automation skill list */
export function createGatewayMenuCard(): CardBuildResult {
  return createCardV2({
    title: '自动化技能',
    subtitle: '后台能力',
    template: 'green',
    icon: { token: 'robot_outlined', color: 'green' },
    tags: [
      { text: 'automation', color: 'green' },
      { text: '1 skill', color: 'neutral' },
    ],
    elements: [
      md('这些技能可以在后台监听事件，并只返回最终结果。'),
      columnSet([
        [
          interactiveCard({
            title: 'Web 服务监控',
            description: '监听异常日志，触发自动修复。',
            icon: 'search_outlined',
            color: 'green',
            action: 'menu:gateway-web-monitor',
          }),
        ],
      ]),
    ],
    buttons: [
      { text: '新建服务', action: 'menu:gateway-new-service' },
      { text: '返回', action: 'menu:back' },
    ],
  });
}

/** Level 3: Web monitor automation skill */
export function createWebMonitorMenuCard(services: ServiceEntry[] = listServices()): CardBuildResult {
  if (services.length === 0) {
    return createCardV2({
      title: 'Web 服务监控',
      subtitle: '自动化技能',
      template: 'grey',
      icon: { token: 'search_outlined', color: 'grey' },
      tags: [
        { text: '0 services', color: 'neutral' },
      ],
      elements: [
        iconMd('**暂无监控服务**\n点击“新建监控”开始。', 'search_outlined', 'grey'),
      ],
      buttons: [
        { text: '新建监控', action: 'menu:web-monitor-new' },
        { text: '返回自动化技能', action: 'menu:gateway' },
        { text: '返回', action: 'menu:back' },
      ],
    });
  }

  return createCardV2({
    title: 'Web 服务监控',
    subtitle: '监控服务列表',
    template: 'green',
    icon: { token: 'search_outlined', color: 'green' },
    tags: [
      { text: `${services.length} services`, color: 'green' },
    ],
    elements: [
      iconMd('**监控列表**\n点击服务查看详情。', 'search_outlined', 'green'),
      ...services.map((service, index) => sessionOptionCard({
        title: `${index + 1}. ${service.name}`,
        description: [
          `${service.githubOwner}/${service.githubRepo}`,
          `${service.enabled ? '启用' : '停用'} · ${service.lastCheckedAt ? relativeTime(service.lastCheckedAt) : '未检查'}`,
          `PR：${service.autoPr ? `${service.prBaseBranch || 'main'} · ${service.prDraft === false ? 'ready' : 'draft'}` : '关闭'}`,
        ].join('\n'),
        icon: service.enabled ? 'search_outlined' : 'stop_outlined',
        color: service.enabled ? 'green' : 'grey',
        action: `menu:web-monitor-detail:${service.name}`,
      })),
    ],
    buttons: [
      { text: '新建监控', action: 'menu:web-monitor-new' },
      { text: '返回自动化技能', action: 'menu:gateway' },
      { text: '返回', action: 'menu:back' },
    ],
  });
}

export function createWebMonitorDetailCard(service: ServiceEntry): CardBuildResult {
  const latestLog = service.lastTracebackPreview
    ? codeBlock(service.lastTracebackPreview.slice(0, 800))
    : '暂无日志缓存';
  const claudeRun = service.lastClaudeRunAt
    ? `${service.lastClaudeRunSuccess ? '✅ 成功' : '❌ 失败'} · ${relativeTime(service.lastClaudeRunAt)}\n${service.lastClaudeRunSummary || ''}`
    : '暂无记录';
  const prConfig = service.autoPr
    ? `自动 PR · base: \`${service.prBaseBranch || 'main'}\` · ${service.prDraft === false ? 'ready' : 'draft'}`
    : '关闭';

  const confirmConfig = service.requireConfirmation ? '开启' : '关闭';
  const pollInterval = service.pollIntervalSec ? `${service.pollIntervalSec}秒` : '60秒（默认）';
  const lastChecked = service.lastCheckedAt ? relativeTime(service.lastCheckedAt) : '未检查';

  return createCardV2({
    title: service.name,
    subtitle: 'Web 服务监控详情',
    template: service.enabled ? 'green' : 'grey',
    icon: { token: 'details_outlined', color: service.enabled ? 'green' : 'grey' },
    tags: [
      { text: service.enabled ? 'enabled' : 'disabled', color: service.enabled ? 'green' : 'neutral' },
      { text: 'web-monitor', color: 'green' },
    ],
    elements: [
      displayBox({
        title: '仓库',
        content: `\`${service.githubOwner}/${service.githubRepo}\``,
        icon: 'folder_outlined',
        color: 'green',
      }),
      displayBox({
        title: '本地目录',
        content: service.localRepoPath ? `\`${service.localRepoPath}\`` : '未初始化',
        icon: 'local_outlined',
        color: service.localRepoPath ? 'green' : 'grey',
      }),
      displayBox({
        title: 'Traceback URL',
        content: service.tracebackUrl,
        icon: 'link-copy_outlined',
        color: 'green',
      }),
      displayBox({
        title: '轮询间隔',
        content: pollInterval,
        icon: 'time_outlined',
        color: 'blue',
      }),
      displayBox({
        title: '最后检查',
        content: lastChecked,
        icon: 'refresh_outlined',
        color: 'grey',
      }),
      displayBox({
        title: '确认模式',
        content: confirmConfig,
        icon: 'confirm_outlined',
        color: service.requireConfirmation ? 'blue' : 'grey',
      }),
      displayBox({
        title: 'PR 设置',
        content: prConfig,
        icon: 'git_branch_outlined',
        color: service.autoPr ? 'green' : 'grey',
      }),
      displayBox({
        title: '最近 Claude Code 介入',
        content: claudeRun,
        icon: 'robot_outlined',
        color: service.lastClaudeRunSuccess === false ? 'red' : 'blue',
      }),
      displayBox({
        title: '最近日志片段',
        content: latestLog,
        icon: 'doc-search_outlined',
        color: 'orange',
      }),
    ],
    buttons: [
      { text: '以此目录新建会话', action: `menu:web-monitor-session:${service.name}` },
      { text: '清除 Hash', action: `menu:web-monitor-clear-hash:${service.name}` },
      { text: '删除监控', action: `menu:web-monitor-delete:${service.name}` },
      { text: '返回', action: 'menu:gateway-web-monitor' },
    ],
  });
}

/** Level 4: Web monitor creation form */
export function createWebMonitorInputCard(): object {
  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: '新建监控' },
      subtitle: { tag: 'plain_text', content: 'Web 服务监控' },
      template: 'green',
      icon: {
        tag: 'standard_icon',
        token: 'search_outlined',
        color: 'green',
      },
      padding: '12px',
    },
    config: {
      update_multi: true,
      summary: { content: '新建 Web 服务监控' },
    },
    body: {
      elements: [
        iconMd('**填写监控信息**\n默认只保留本地修复，不自动提交 PR。', 'search_outlined', 'green'),
        {
          tag: 'form',
          direction: 'vertical',
          vertical_spacing: '12px',
          padding: '4px 0px 0px 0px',
          margin: '8px 0px 0px 0px',
          name: 'wm_form',
          elements: [
            {
              tag: 'input',
              element_id: 'wm_name',
              name: 'wm_name',
              required: true,
              width: 'fill',
              max_length: 80,
              label: { tag: 'plain_text', content: '服务名称' },
              placeholder: { tag: 'plain_text', content: '例如 my-api' },
            },
            {
              tag: 'input',
              element_id: 'wm_repo',
              name: 'wm_repo',
              required: true,
              width: 'fill',
              max_length: 160,
              label: { tag: 'plain_text', content: 'GitHub 仓库' },
              placeholder: { tag: 'plain_text', content: 'owner/repo' },
            },
            {
              tag: 'input',
              element_id: 'wm_url',
              name: 'wm_url',
              required: true,
              width: 'fill',
              max_length: 500,
              label: { tag: 'plain_text', content: 'Traceback URL' },
              placeholder: { tag: 'plain_text', content: 'https://example.com/traceback' },
            },
            {
              tag: 'column_set',
              horizontal_spacing: '8px',
              horizontal_align: 'left',
              columns: [
                {
                  tag: 'column',
                  width: 'weighted',
                  weight: 1,
                  elements: [
                    md('**自动提交 PR**'),
                  ],
                },
                {
                  tag: 'column',
                  width: 'weighted',
                  weight: 3,
                  elements: [
                    {
                      tag: 'select_static',
                      element_id: 'wm_auto_pr',
                      name: 'wm_auto_pr',
                      required: false,
                      width: 'fill',
                      type: 'default',
                      placeholder: { tag: 'plain_text', content: '默认关闭' },
                      options: [
                        {
                          text: { tag: 'plain_text', content: '关闭：只保留本地修复' },
                          value: 'false',
                        },
                        {
                          text: { tag: 'plain_text', content: '开启：修复后创建 PR' },
                          value: 'true',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              tag: 'input',
              element_id: 'wm_pr_base',
              name: 'wm_pr_base',
              required: false,
              width: 'fill',
              max_length: 120,
              default_value: 'main',
              label: { tag: 'plain_text', content: 'PR 目标分支' },
              placeholder: { tag: 'plain_text', content: 'main' },
            },
            {
              tag: 'column_set',
              horizontal_spacing: '8px',
              horizontal_align: 'left',
              columns: [
                {
                  tag: 'column',
                  width: 'weighted',
                  weight: 1,
                  elements: [
                    md('**PR 模式**'),
                  ],
                },
                {
                  tag: 'column',
                  width: 'weighted',
                  weight: 3,
                  elements: [
                    {
                      tag: 'select_static',
                      element_id: 'wm_pr_mode',
                      name: 'wm_pr_mode',
                      required: false,
                      width: 'fill',
                      type: 'default',
                      placeholder: { tag: 'plain_text', content: '默认 draft' },
                      options: [
                        {
                          text: { tag: 'plain_text', content: 'Draft PR' },
                          value: 'draft',
                        },
                        {
                          text: { tag: 'plain_text', content: 'Ready PR' },
                          value: 'ready',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              tag: 'input',
              element_id: 'wm_pr_branch_prefix',
              name: 'wm_pr_branch_prefix',
              required: false,
              width: 'fill',
              max_length: 160,
              default_value: 'oh-my-feishu/web-monitor',
              label: { tag: 'plain_text', content: 'PR 分支前缀' },
              placeholder: { tag: 'plain_text', content: 'oh-my-feishu/web-monitor' },
            },
            {
              tag: 'column_set',
              horizontal_spacing: '8px',
              horizontal_align: 'left',
              columns: [
                {
                  tag: 'column',
                  width: 'weighted',
                  weight: 1,
                  elements: [
                    md('**确认模式**'),
                  ],
                },
                {
                  tag: 'column',
                  width: 'weighted',
                  weight: 3,
                  elements: [
                    {
                      tag: 'select_static',
                      element_id: 'wm_require_confirmation',
                      name: 'wm_require_confirmation',
                      required: false,
                      width: 'fill',
                      type: 'default',
                      placeholder: { tag: 'plain_text', content: '默认关闭' },
                      options: [
                        {
                          text: { tag: 'plain_text', content: '关闭：自动修复' },
                          value: 'false',
                        },
                        {
                          text: { tag: 'plain_text', content: '开启：修复前确认' },
                          value: 'true',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              tag: 'column_set',
              flex_mode: 'none',
              horizontal_spacing: '8px',
              horizontal_align: 'right',
              columns: [
                {
                  tag: 'column',
                  width: 'auto',
                  elements: [
                    {
                      tag: 'button',
                      text: { tag: 'plain_text', content: '创建监控' },
                      type: 'primary',
                      width: 'default',
                      icon: { tag: 'standard_icon', token: 'add_outlined' },
                      action_type: 'form_submit',
                      form_action_type: 'submit',
                      name: 'wm_submit',
                    },
                  ],
                },
                {
                  tag: 'column',
                  width: 'auto',
                  elements: [
                    {
                      tag: 'button',
                      text: { tag: 'plain_text', content: '清空' },
                      type: 'default',
                      width: 'default',
                      action_type: 'form_reset',
                      form_action_type: 'reset',
                      name: 'wm_reset',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '返回 Web 服务监控' },
          type: 'default',
          width: 'default',
          behaviors: [
            {
              type: 'callback',
              value: { action: 'menu:gateway-web-monitor' },
            },
          ],
        },
      ],
    },
  };
}

/** Level 2: Command reference */
export function createCommandMenuCard(): CardBuildResult {
  return createCardV2({
    title: '指令菜单',
    subtitle: 'Slash commands',
    template: 'orange',
    icon: { token: 'command_outlined', color: 'orange' },
    tags: [
      { text: 'commands', color: 'orange' },
    ],
    elements: [
      iconMd('**对话与会话**\n普通消息会直接进入 Claude Code；需要切换上下文时使用菜单入口。', 'chatbox_outlined', 'orange'),
      commandTable(),
    ],
    buttons: [
      { text: '返回', action: 'menu:back' },
    ],
  });
}

/** Level 2a: New Session submenu */
export function createNewSessionCard(): CardBuildResult {
  return createCardV2({
    title: '新建会话',
    subtitle: '选择 Claude Code 的工作上下文',
    template: 'blue',
    icon: { token: 'add_outlined', color: 'blue' },
    tags: [{ text: 'session', color: 'blue' }],
    elements: [
      columnSet([
        [
          interactiveCard({
            title: '直接对话',
            description: '使用默认 workspace，适合一般问答和轻量任务。',
            icon: 'chatbox_outlined',
            color: 'blue',
            action: 'menu:new-direct',
          }),
        ],
        [
          interactiveCard({
            title: '目录会话',
            description: '绑定指定项目目录，适合代码修改、构建和调试。',
            icon: 'folder_outlined',
            color: 'green',
            action: 'menu:new-directory',
          }),
        ],
      ]),
    ],
    buttons: [
      { text: '返回', action: 'menu:back' },
    ],
  });
}

/** Directory input card with form + input for inline path entry */
export function createDirectoryInputCard(): object {
  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: '目录会话' },
      subtitle: { tag: 'plain_text', content: '输入本机项目路径' },
      template: 'blue',
      icon: {
        tag: 'standard_icon',
        token: 'folder_outlined',
        color: 'blue',
      },
      padding: '12px',
    },
    config: {
      update_multi: true,
      summary: { content: '目录会话' },
    },
    body: {
      elements: [
        columnSet([
          [
            iconMd('**支持路径**\n绝对路径、相对路径、父级路径都可以。', 'folder_outlined', 'blue'),
          ],
          [
            md('`/home/user/my-project`\n`./my-project`\n`../parent`'),
          ],
        ]),
        {
          tag: 'form',
          direction: 'vertical',
          vertical_spacing: '12px',
          padding: '4px 0px 0px 0px',
          margin: '8px 0px 0px 0px',
          elements: [
            {
              tag: 'input',
              element_id: 'input_dir_path',
              placeholder: {
                tag: 'plain_text',
                content: '输入目录路径...',
              },
              default_value: '',
              width: 'default',
              label: {
                tag: 'plain_text',
                content: '目录路径：',
              },
              name: 'dir_path',
              required: true,
              max_length: 500,
            },
            {
              tag: 'column_set',
              flex_mode: 'bisect',
              background_style: 'default',
              horizontal_spacing: '8px',
              horizontal_align: 'right',
              columns: [
                {
                  tag: 'column',
                  width: 'auto',
                  vertical_align: 'top',
                  elements: [
                    {
                      tag: 'button',
                      text: {
                        tag: 'plain_text',
                        content: '创建会话',
                      },
                      type: 'primary',
                      width: 'default',
                      icon: {
                        tag: 'standard_icon',
                        token: 'add_outlined',
                      },
                      action_type: 'form_submit',
                      form_action_type: 'submit',
                      name: 'btn_submit_dir',
                    },
                  ],
                },
                {
                  tag: 'column',
                  width: 'auto',
                  vertical_align: 'top',
                  elements: [
                    {
                      tag: 'button',
                      text: {
                        tag: 'plain_text',
                        content: '返回',
                      },
                      type: 'default',
                      width: 'default',
                      icon: {
                        tag: 'standard_icon',
                        token: 'left_outlined',
                      },
                      behaviors: [
                        {
                          type: 'callback',
                          value: { action: 'menu:back' },
                        },
                      ],
                      name: 'btn_back_dir',
                    },
                  ],
                },
              ],
              margin: '0px',
            },
          ],
          name: 'dir_form',
        },
      ],
    },
  };
}

export function createDirectorySessionSelectCard(
  directory: string,
  sessions: { id: string; lastActive: string; summary?: string }[]
): CardBuildResult {
  return createCardV2({
    title: '选择会话',
    subtitle: '连接已有 Claude Code session，或创建新会话',
    template: 'indigo',
    icon: { token: 'folder_outlined', color: 'indigo' },
    tags: [{ text: `${sessions.length} 个可恢复`, color: 'indigo' }],
    elements: [
      iconMd(`**目录**\n\`${directory}\``, 'folder_outlined', 'indigo'),
      ...sessions.slice(0, 10).map((session, index) => sessionOptionCard({
        title: `${index + 1}. ${session.summary || '未识别摘要'}`,
        description: `最近活动：${session.lastActive}\nSession：\`${session.id.slice(0, 8)}...\``,
        icon: 'chatbox_outlined',
        color: 'indigo',
        action: `session:select:${session.id}`,
      })),
      iconMd('**下一步**\n点击下方按钮选择要连接的会话，或创建一个新的目录会话。', 'info_outlined', 'grey'),
    ],
    buttons: [
      { text: '新建会话', action: 'session:select:new' },
      { text: '取消', action: 'session:add-cancel' },
    ],
  });
}

export function createDirectorySessionSuccessCard(directory: string, sessionId: string | null): CardBuildResult {
  const sessionContent = sessionId
    ? `已连接 \`${sessionId}\``
    : '将创建新的 Claude Code 会话';

  return createCardV2({
    title: '目录会话已创建',
    subtitle: sessionId ? '已连接已有 Claude Code session' : '新目录会话',
    template: 'green',
    icon: { token: 'check_outlined', color: 'green' },
    tags: [{ text: sessionId ? 'resumed' : 'new', color: 'green' }],
    elements: [
      columnSet([
        [iconMd(`**目录**\n\`${directory}\``, 'folder_outlined', 'green')],
        [iconMd(`**会话**\n${sessionContent}`, 'chatbox_outlined', 'green')],
      ]),
      iconMd('**可以开始对话**\n接下来发送消息，Claude Code 会在这个目录上下文中处理。', 'send_outlined', 'grey'),
    ],
    buttons: [
      { text: '返回菜单', action: 'menu:back' },
    ],
  });
}

/** Level 2b: Session History submenu */
export function createSessionHistoryCard(entries: HistoryEntry[]): CardBuildResult {
  if (entries.length === 0) {
    return createCardV2({
      title: '历史会话',
      subtitle: '最近使用过的目录上下文',
      template: 'grey',
      icon: { token: 'history_outlined', color: 'grey' },
      elements: [
        {
          tag: 'column_set',
          flex_mode: 'none',
          horizontal_align: 'center',
          columns: [
            {
              tag: 'column',
              width: 'weighted',
              weight: 1,
              horizontal_align: 'center',
              elements: [
                iconMd('**暂无历史会话**\n创建目录会话后，会自动保存到这里。', 'history_outlined', 'grey'),
              ],
            },
          ],
        },
      ],
      buttons: [
        { text: '返回', action: 'menu:back' },
      ],
    });
  }

  return createCardV2({
    title: '历史会话',
    subtitle: '最近使用过的目录上下文',
    template: 'grey',
    icon: { token: 'history_outlined', color: 'grey' },
    tags: [{ text: `${entries.length}`, color: 'neutral' }],
    elements: [
      iconMd(`**历史列表**\n共 ${entries.length} 个历史会话。点击条目查看详情、继续或删除。`, 'history_outlined', 'grey'),
      ...entries.map((entry, index) => sessionOptionCard({
        title: `${index + 1}. ${historyEntryTitle(entry)}`,
        description: `${entry.directory}\n${entry.sessionId ? `Session：\`${entry.sessionId.slice(0, 8)}...\`` : '新会话'} · ${relativeTime(entry.lastUsed)}`,
        icon: 'folder_outlined',
        color: 'grey',
        action: `menu:detail:${index}`,
      })),
    ],
    buttons: [
      { text: '返回', action: 'menu:back' },
    ],
  });
}

/** Level 3: Session Detail */
export function createSessionDetailCard(entry: HistoryEntry, index: number): CardBuildResult {
  const sessionIdDisplay = entry.sessionId
    ? `\`${entry.sessionId}\``
    : '新会话（无 ID）';

  return createCardV2({
    title: '会话详情',
    subtitle: '恢复或删除此目录上下文',
    template: 'indigo',
    icon: { token: 'details_outlined', color: 'indigo' },
    elements: [
      columnSet([
        [iconMd(`**目录**\n\`${entry.directory}\``, 'folder_outlined', 'indigo')],
        [iconMd(`**Session ID**\n${sessionIdDisplay}\n\n**上次使用**\n${relativeTime(entry.lastUsed)}`, 'time_outlined', 'indigo')],
      ]),
    ],
    buttons: [
      { text: '继续会话', action: `menu:resume:${index}` },
      { text: '删除会话', action: `menu:delete:${index}` },
      { text: '返回历史', action: 'menu:history' },
    ],
  });
}
