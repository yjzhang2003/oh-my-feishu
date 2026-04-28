// Feishu Card types
// Reference: https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN

export interface CardElement {
  tag: string;
  [key: string]: unknown;
}

export interface FeishuCard {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: 'plain_text' | 'lark_md';
      content: string;
    };
    template?: string;
  };
  elements: CardElement[];
}
