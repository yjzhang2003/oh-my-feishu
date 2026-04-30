/**
 * Menu card builders for 3-level hierarchical navigation
 * Generates Feishu Card JSON 2.0 for cardkit batch_update support
 */

import type { HistoryEntry } from '../interactions/session-history-store.js';

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
      { name: 'command', display_name: '命令', data_type: 'lark_md', width: '28%' },
      { name: 'usage', display_name: '用途', data_type: 'text', width: '72%' },
    ],
    rows: [
      { command: '`/menu`', usage: '打开菜单' },
      { command: '`/status`', usage: '查看运行状态' },
      { command: '`/service list`', usage: '查看监控服务' },
      { command: '`/service add <name> <owner/repo> <url>`', usage: '注册监控服务' },
      { command: '`/service enable <name>`', usage: '启用监控服务' },
      { command: '`/service disable <name>`', usage: '停用监控服务' },
      { command: '`/repair <context>`', usage: '触发后台修复流程' },
    ],
  };
}

function historyTable(entries: HistoryEntry[]): CardV2Element {
  return {
    tag: 'table',
    page_size: Math.min(Math.max(entries.length, 1), 5),
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
      { name: 'index', display_name: '#', data_type: 'text', width: '12%', horizontal_align: 'center' },
      { name: 'directory', display_name: '目录', data_type: 'lark_md', width: '48%' },
      { name: 'session', display_name: '会话', data_type: 'text', width: '20%' },
      { name: 'last_used', display_name: '最近', data_type: 'text', width: '20%' },
    ],
    rows: entries.map((entry, i) => ({
      index: String(i + 1),
      directory: `\`${entry.directory.split('/').pop() || entry.directory}\``,
      session: entry.sessionId ? `${entry.sessionId.slice(0, 8)}...` : '新会话',
      last_used: relativeTime(entry.lastUsed),
    })),
  };
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
      md('把飞书对话直接连接到 Claude Code。发送普通消息即可开始对话，需要导航时发送 `/menu`。'),
      columnSet([
        [
          interactiveCard({
            title: '新建会话',
            description: '切换直接对话，或绑定本地项目目录。',
            icon: 'add_outlined',
            color: 'blue',
            action: 'menu:new',
          }),
        ],
        [
          interactiveCard({
            title: '历史会话',
            description: '恢复最近使用过的目录上下文。',
            icon: 'history_outlined',
            color: 'indigo',
            action: 'menu:history',
          }),
        ],
      ]),
      columnSet([
        [
          interactiveCard({
            title: 'Gateway',
            description: '查看后台自动化能力：状态、服务监控和修复任务。',
            icon: 'robot_outlined',
            color: 'green',
            action: 'menu:gateway',
          }),
        ],
        [
          interactiveCard({
            title: '指令菜单',
            description: '查看可用 slash commands 和参数格式。',
            icon: 'command_outlined',
            color: 'orange',
            action: 'menu:commands',
          }),
        ],
      ]),
    ],
  });
}

/** Level 2: Gateway feature overview */
export function createGatewayMenuCard(): CardBuildResult {
  return createCardV2({
    title: 'Gateway',
    subtitle: '后台自动化功能',
    template: 'green',
    icon: { token: 'robot_outlined', color: 'green' },
    tags: [
      { text: 'gateway', color: 'green' },
      { text: 'non-stream', color: 'neutral' },
    ],
    elements: [
      md('Gateway 用于处理后台任务：触发条件进入 feature，调用 Claude Code 静默执行，只把最终结果发回飞书。'),
      columnSet([
        [
          iconMd('**状态检查**\n检查 Claude CLI、WebSocket、GitHub 和服务注册状态。', 'status-meeting_outlined', 'green'),
          iconMd('**服务监控**\n轮询服务 traceback URL，发现新错误后生成 Gateway 事件。', 'search_outlined', 'green'),
        ],
        [
          iconMd('**自动修复**\n后台调用 Claude Code 处理错误上下文，不展示中间流式输出。', 'robot_outlined', 'green'),
          iconMd('**CLI Gateway**\n本机可用 `oh-my-feishu gateway ...` 查看或触发 feature。', 'command_outlined', 'green'),
        ],
      ]),
      interactiveCard({
        title: '指令菜单',
        description: '查看 Gateway 相关 slash commands 和 CLI 命令。',
        icon: 'command_outlined',
        color: 'orange',
        action: 'menu:commands',
      }),
    ],
    buttons: [
      { text: '返回', action: 'menu:back' },
    ],
  });
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
      md('CLI 侧 Gateway：`oh-my-feishu gateway list`、`oh-my-feishu gateway status`、`oh-my-feishu gateway trigger <feature> <eventType> <jsonPayload>`'),
    ],
    buttons: [
      { text: 'Gateway', action: 'menu:gateway' },
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
      iconMd(`**历史列表**\n共 ${entries.length} 个历史会话。点击下方按钮查看详情。`, 'history_outlined', 'grey'),
      historyTable(entries),
    ],
    buttons: [
      ...entries.map((_, i) => ({
        text: `${i + 1}. ${_.directory.split('/').pop() || _.directory}`,
        action: `menu:detail:${i}`,
      })),
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
