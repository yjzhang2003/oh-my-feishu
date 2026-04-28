/**
 * Menu card builders for 3-level hierarchical navigation
 * Generates Feishu Card JSON 2.0 for cardkit batch_update support
 */

import type { HistoryEntry } from '../interactions/session-history-store.js';

export interface CardBuildResult {
  card: object;
  elementIds: string[];
}

let idCounter = 0;
function genId(tag: string): string {
  return `${tag}_${++idCounter}`;
}

function md(content: string): { tag: 'markdown'; content: string } {
  return { tag: 'markdown', content };
}

interface CallbackButton {
  text: string;
  action: string;
}

function createCardV2(options: {
  title?: string;
  elements: { tag: string; content: string }[];
  buttons?: CallbackButton[];
}): CardBuildResult {
  const elementIds: string[] = [];
  const bodyElements: object[] = [];

  // Optional title as first markdown element
  if (options.title) {
    const id = genId('title');
    elementIds.push(id);
    bodyElements.push({
      tag: 'markdown',
      element_id: id,
      content: `**${options.title}**`,
    });
  }

  for (const el of options.elements) {
    const id = genId(el.tag);
    elementIds.push(id);
    bodyElements.push({ ...el, element_id: id });
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
        content: options.title || 'Feishu Agent',
        tag: 'plain_text',
      },
      template: 'blue',
    },
    config: {
      update_multi: true,
      summary: {
        content: options.title || 'Feishu Agent',
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
    title: '🤖 Feishu Agent',
    elements: [
      md('👋 欢迎使用 Feishu Agent！'),
      md(''),
      md('我可以帮你分析错误日志、自动修复问题、管理监控服务。'),
      md(''),
      md('💡 发送消息即可对话，发送 `/菜单` 可随时调出此菜单'),
    ],
    buttons: [
      { text: '🆕 新建会话', action: 'menu:new' },
      { text: '📋 历史会话', action: 'menu:history' },
    ],
  });
}

/** Level 2a: New Session submenu */
export function createNewSessionCard(): CardBuildResult {
  return createCardV2({
    title: '🆕 新建会话',
    elements: [
      md('选择会话类型：'),
      md(''),
      md('**🤖 与主 Agent 对话** — 直接在当前会话与 Claude 对话'),
      md('**📁 目录会话** — 在指定项目目录中启动 Claude'),
    ],
    buttons: [
      { text: '🤖 与主 Agent 对话', action: 'menu:new-direct' },
      { text: '📁 目录会话', action: 'menu:new-directory' },
      { text: '◀️ 返回', action: 'menu:back' },
    ],
  });
}

/** Directory input card with form + input for inline path entry */
export function createDirectoryInputCard(): object {
  const formId = 'form_dir_input';
  const inputId = 'input_dir_path';
  const submitBtnId = 'btn_submit_dir';

  return {
    schema: '2.0',
    header: {
      title: { content: '📁 创建目录会话', tag: 'plain_text' },
      template: 'purple',
    },
    config: { update_multi: true },
    body: {
      elements: [
        {
          tag: 'markdown',
          content: '**请输入要打开的目录路径**',
        },
        {
          tag: 'markdown',
          content: '`/home/user/my-project` · `./my-project` · `../parent`',
        },
        {
          tag: 'form',
          name: formId,
          elements: [
            {
              tag: 'input',
              element_id: inputId,
              name: 'dir_path',
              placeholder: { tag: 'plain_text', content: '输入目录路径...' },
              max_length: 500,
            },
            {
              tag: 'column_set',
              flex_mode: 'none',
              horizontal_spacing: 'default',
              columns: [
                {
                  tag: 'column',
                  width: 'auto',
                  elements: [
                    {
                      tag: 'button',
                      element_id: submitBtnId,
                      text: { tag: 'plain_text', content: '✅ 创建会话' },
                      type: 'primary',
                      action_type: 'form_submit',
                    },
                  ],
                },
                {
                  tag: 'column',
                  width: 'auto',
                  elements: [
                    {
                      tag: 'button',
                      text: { tag: 'plain_text', content: '◀️ 返回' },
                      type: 'default',
                      action_type: 'callback',
                      value: { action: 'menu:back' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/** Level 2b: Session History submenu */
export function createSessionHistoryCard(entries: HistoryEntry[]): CardBuildResult {
  if (entries.length === 0) {
    return createCardV2({
      title: '📋 历史会话',
      elements: [
        md('暂无历史会话'),
        md(''),
        md('创建新会话后会自动保存到历史记录'),
      ],
      buttons: [
        { text: '◀️ 返回', action: 'menu:back' },
      ],
    });
  }

  const elements = [
    md(`**共 ${entries.length} 个历史会话**`),
    md(''),
  ];

  entries.forEach((entry, i) => {
    const sessionId = entry.sessionId
      ? entry.sessionId.slice(0, 8) + '...'
      : '新会话';
    elements.push(md(`${i + 1}. \`${entry.directory}\` — ${sessionId} · ${relativeTime(entry.lastUsed)}`));
  });
  elements.push(md(''));
  elements.push(md('*点击目录按钮查看详情*'));

  return createCardV2({
    title: '📋 历史会话',
    elements,
    buttons: [
      ...entries.map((_, i) => ({
        text: `${i + 1}. ${_.directory.split('/').pop() || _.directory}`,
        action: `menu:detail:${i}`,
      })),
      { text: '◀️ 返回', action: 'menu:back' },
    ],
  });
}

/** Level 3: Session Detail */
export function createSessionDetailCard(entry: HistoryEntry, index: number): CardBuildResult {
  const sessionIdDisplay = entry.sessionId
    ? `\`${entry.sessionId}\``
    : '新会话（无 ID）';

  return createCardV2({
    title: '📄 会话详情',
    elements: [
      md(`**目录：** \`${entry.directory}\``),
      md(`**Session ID：** ${sessionIdDisplay}`),
      md(`**上次使用：** ${relativeTime(entry.lastUsed)}`),
    ],
    buttons: [
      { text: '▶️ 继续会话', action: `menu:resume:${index}` },
      { text: '🗑️ 删除会话', action: `menu:delete:${index}` },
      { text: '◀️ 返回历史', action: 'menu:history' },
    ],
  });
}
