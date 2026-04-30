/**
 * Interactive card builder with callback buttons
 * Replaces static card templates with dynamic, interactive cards
 */

import type { FeishuCard, CardElement } from './card.js';

// Callback button configuration
export interface CallbackButton {
  text: string;
  action: string; // e.g. "service:add", "nav:help"
  value?: Record<string, unknown>;
  type?: 'primary' | 'default' | 'danger';
}

// Build a card with callback buttons in action area
export function createCallbackCard(options: {
  title?: string;
  subtitle?: string;
  elements: CardElement[];
  buttons?: CallbackButton[];
  headerColor?: 'blue' | 'red' | 'orange' | 'green' | 'purple' | 'wathet' | 'gray';
}): FeishuCard {
  const elements: CardElement[] = [];

  // Add content elements
  for (const el of options.elements) {
    elements.push(el);
  }

  // Add action buttons if provided
  if (options.buttons && options.buttons.length > 0) {
    elements.push({ tag: 'hr' });
    const actions: CardElement[] = options.buttons.map((btn) => ({
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: btn.text,
      },
      type: btn.type || 'default',
      value: {
        action: btn.action,
        ...(btn.value || {}),
      },
    }));
    elements.push({ tag: 'action', actions });
  }

  const card: FeishuCard = {
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    elements,
  };

  if (options.title) {
    card.header = {
      title: {
        tag: 'plain_text',
        content: options.title,
      },
      template: options.headerColor || 'blue',
    };
  }

  return card;
}

// Markdown element helper
export function md(content: string): CardElement {
  return { tag: 'markdown', content };
}

// Service add step 1: name input
export function createServiceAddStep1Card(): FeishuCard {
  return createCallbackCard({
    title: '➕ 注册服务 - Step 1/3',
    elements: [
      md('**请输入服务名称**'),
      md(''),
      md('服务名称用于唯一标识该服务，例如：'),
      md('- `my-api`'),
      md('- `payment-service`'),
      md('- `user-center-v2`'),
      md(''),
      md('*输入服务名称后发送给我*'),
    ],
    buttons: [
      { text: '◀️ 取消', action: 'service:add-cancel', type: 'danger' },
    ],
    headerColor: 'green',
  });
}

// Service add step 2: repo input
export function createServiceAddStep2Card(name: string): FeishuCard {
  return createCallbackCard({
    title: '➕ 注册服务 - Step 2/3',
    elements: [
      md(`**服务名称:** \`${name}\` ✅`),
      md(''),
      md('**请输入 GitHub 仓库**'),
      md(''),
      md('格式：`owner/repo`，例如：'),
      md('- `myorg/my-api`'),
      md('- `acme-corp/backend`'),
      md(''),
      md('*输入仓库地址后发送给我*'),
    ],
    buttons: [
      { text: '◀️ 取消', action: 'service:add-cancel', type: 'danger' },
    ],
    headerColor: 'green',
  });
}

// Service add step 3: traceback URL input
export function createServiceAddStep3Card(name: string, repo: string): FeishuCard {
  return createCallbackCard({
    title: '➕ 注册服务 - Step 3/3',
    elements: [
      md(`**服务名称:** \`${name}\` ✅`),
      md(`**仓库:** \`${repo}\` ✅`),
      md(''),
      md('**请输入 Traceback 日志地址**'),
      md(''),
      md('提供日志接口的 URL，格式要求：'),
      md('- 必须以 `http://` 或 `https://` 开头'),
      md('- 例如：`https://logs.example.com/api/tracebacks`'),
      md('- 支持 JSON、Text、HTML 格式'),
      md(''),
      md('*输入 URL 后发送给我*'),
    ],
    buttons: [
      { text: '◀️ 取消', action: 'service:add-cancel', type: 'danger' },
    ],
    headerColor: 'green',
  });
}

// Service add success card
export function createServiceAddSuccessCard(name: string, repo: string, tracebackUrl: string): FeishuCard {
  return createCallbackCard({
    title: '✅ 服务注册成功',
    elements: [
      md('**服务已成功注册！**'),
      md(''),
      md(`| 项目 | 值 |`),
      md(`|------|-----|`),
      md(`| 名称 | \`${name}\` |`),
      md(`| 仓库 | \`${repo}\` |`),
      md(`| 日志地址 | ${tracebackUrl} |`),
      md(''),
      md('TracebackMonitor 将开始轮询此服务的日志。'),
    ],
    buttons: [
      { text: '📋 返回服务管理', action: 'nav:service', type: 'primary' },
      { text: '◀️ 返回导航', action: 'nav:back', type: 'default' },
    ],
    headerColor: 'green',
  });
}

// Service add cancelled card
export function createServiceAddCancelledCard(): FeishuCard {
  return createCallbackCard({
    title: '❌ 注册已取消',
    elements: [
      md('服务注册已取消。'),
      md('没有添加任何服务。'),
    ],
    buttons: [
      { text: '◀️ 返回导航', action: 'nav:back', type: 'default' },
    ],
    headerColor: 'red',
  });
}

// Error card with message
export function createErrorCard(message: string): FeishuCard {
  return createCallbackCard({
    title: '❌ 操作失败',
    elements: [
      md(`**错误信息:** ${message}`),
    ],
    buttons: [
      { text: '◀️ 返回导航', action: 'nav:back', type: 'default' },
    ],
    headerColor: 'red',
  });
}
