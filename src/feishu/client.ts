import { env } from '../config/env.js';

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

interface TokenResponse {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
}

interface SendMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id: string;
  };
}

// Token cache
let cachedToken: string | null = null;
let tokenExpireAt: number = 0;

export async function getTenantAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken;
  }

  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: env.FEISHU_APP_ID,
      app_secret: env.FEISHU_APP_SECRET,
    }),
  });

  const data = (await response.json()) as TokenResponse;

  if (data.code !== 0) {
    throw new Error(`Failed to get tenant access token: ${data.msg}`);
  }

  cachedToken = data.tenant_access_token;
  // Cache for slightly less than the expire time
  tokenExpireAt = Date.now() + (data.expire - 60) * 1000;

  return cachedToken;
}

export interface SendMessageOptions {
  receiveId: string;
  receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id';
  msgType: 'text' | 'post' | 'interactive';
  content: string | object;
}

export async function sendMessage(options: SendMessageOptions): Promise<string> {
  const token = await getTenantAccessToken();

  const url = new URL(`${FEISHU_BASE_URL}/im/v1/messages`);
  url.searchParams.set('receive_id_type', options.receiveIdType);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: options.receiveId,
      msg_type: options.msgType,
      content: typeof options.content === 'string' ? options.content : JSON.stringify(options.content),
    }),
  });

  const data = (await response.json()) as SendMessageResponse;

  if (data.code !== 0) {
    throw new Error(`Failed to send message: ${data.msg}`);
  }

  return data.data?.message_id || '';
}

export async function sendTextMessage(receiveId: string, text: string, receiveIdType: SendMessageOptions['receiveIdType'] = 'chat_id'): Promise<string> {
  return sendMessage({
    receiveId,
    receiveIdType,
    msgType: 'text',
    content: JSON.stringify({ text }),
  });
}

export async function sendCardMessage(receiveId: string, card: object, receiveIdType: SendMessageOptions['receiveIdType'] = 'chat_id'): Promise<string> {
  return sendMessage({
    receiveId,
    receiveIdType,
    msgType: 'interactive',
    content: card,
  });
}
