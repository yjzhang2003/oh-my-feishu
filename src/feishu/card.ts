// Feishu Interactive Card Builder
// Reference: https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN

export interface CardConfig {
  wide_screen_mode?: boolean;
  enable_forward?: boolean;
}

export interface CardHeader {
  title: {
    tag: 'plain_text' | 'lark_md';
    content: string;
  };
  template?: string;
}

export interface CardElement {
  tag: string;
  [key: string]: unknown;
}

export interface FeishuCard {
  config?: CardConfig;
  header?: CardHeader;
  elements: CardElement[];
}

export function createCard(options: {
  title?: string;
  wideScreen?: boolean;
  elements: CardElement[];
}): FeishuCard {
  const card: FeishuCard = {
    config: {
      wide_screen_mode: options.wideScreen ?? true,
      enable_forward: true,
    },
    elements: options.elements,
  };

  if (options.title) {
    card.header = {
      title: {
        tag: 'plain_text',
        content: options.title,
      },
      template: 'blue',
    };
  }

  return card;
}

// Common elements
export function createMarkdownElement(content: string): CardElement {
  return {
    tag: 'markdown',
    content,
  };
}

export function createDividerElement(): CardElement {
  return {
    tag: 'divider',
  };
}

export function createActionElement(actions: CardElement[]): CardElement {
  return {
    tag: 'action',
    actions,
  };
}

export function createButtonElement(options: {
  text: string;
  url?: string;
  type?: 'primary' | 'default' | 'danger';
}): CardElement {
  return {
    tag: 'button',
    text: {
      tag: 'plain_text',
      content: options.text,
    },
    url: options.url,
    type: options.type || 'default',
  };
}

// Result card templates
export function createSuccessCard(title: string, content: string): FeishuCard {
  return createCard({
    title: `✅ ${title}`,
    elements: [
      createMarkdownElement(content),
    ],
  });
}

export function createErrorCard(title: string, error: string): FeishuCard {
  return createCard({
    title: `❌ ${title}`,
    elements: [
      createMarkdownElement(`**Error:** ${error}`),
    ],
  });
}

export function createProgressCard(title: string, steps: string[]): FeishuCard {
  const elements: CardElement[] = [
    createMarkdownElement(`**${title}**`),
    createDividerElement(),
  ];

  for (const step of steps) {
    elements.push(createMarkdownElement(step));
  }

  return createCard({
    title: '🔄 Processing',
    elements,
  });
}

export function createRepairResultCard(options: {
  success: boolean;
  message: string;
  prUrl?: string;
  files?: string[];
}): FeishuCard {
  const elements: CardElement[] = [
    createMarkdownElement(options.message),
  ];

  if (options.files && options.files.length > 0) {
    elements.push(createDividerElement());
    elements.push(createMarkdownElement('**Modified files:**'));
    for (const file of options.files) {
      elements.push(createMarkdownElement(`- \`${file}\``));
    }
  }

  if (options.prUrl) {
    elements.push(createDividerElement());
    elements.push(createActionElement([
      createButtonElement({
        text: 'View Pull Request',
        url: options.prUrl,
        type: 'primary',
      }),
    ]));
  }

  return createCard({
    title: options.success ? '✅ Repair Complete' : '❌ Repair Failed',
    elements,
  });
}
