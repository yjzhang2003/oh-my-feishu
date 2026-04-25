import { env } from '../config/env.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

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

interface LarkCliConfig {
  app_id?: string;
  app_secret?: string;
  brand?: string;
}

// Token cache
let cachedToken: string | null = null;
let tokenExpireAt: number = 0;

// Lark-cli config cache
let larkConfig: LarkCliConfig | null = null;

/**
 * Get credentials from lark-cli config or env
 */
function getCredentials(): { appId: string; appSecret: string } | null {
  // First try lark-cli config
  if (!larkConfig) {
    larkConfig = loadLarkCliConfig();
  }

  if (larkConfig?.app_id && larkConfig?.app_secret) {
    return {
      appId: larkConfig.app_id,
      appSecret: larkConfig.app_secret,
    };
  }

  // Fallback to env
  if (env.FEISHU_APP_ID && env.FEISHU_APP_SECRET) {
    return {
      appId: env.FEISHU_APP_ID,
      appSecret: env.FEISHU_APP_SECRET,
    };
  }

  return null;
}

/**
 * Load config from lark-cli
 */
function loadLarkCliConfig(): LarkCliConfig | null {
  // Try to get config via lark-cli command
  try {
    const result = execSync('lark-cli config show --format json', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const config = JSON.parse(result);
    if (config.app_id) {
      return {
        app_id: config.app_id,
        app_secret: config.app_secret,
        brand: config.brand,
      };
    }
  } catch {
    // lark-cli not configured or not installed
  }

  // Try to read from lark-cli config file
  const configPaths = [
    resolve(homedir(), '.lark-cli', 'config.json'),
    resolve(homedir(), '.config', 'lark-cli', 'config.json'),
    resolve(homedir(), 'Library', 'Application Support', 'lark-cli', 'config.json'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.app_id) {
          return config;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return null;
}

export async function getTenantAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken;
  }

  const creds = getCredentials();
  if (!creds) {
    throw new Error('Feishu credentials not configured. Run: lark-cli config init');
  }

  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: creds.appId,
      app_secret: creds.appSecret,
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

/**
 * Check if Feishu is configured (via lark-cli or env)
 */
export function isFeishuConfigured(): boolean {
  return getCredentials() !== null;
}

/**
 * Get current app_id
 */
export function getAppId(): string | null {
  const creds = getCredentials();
  return creds?.appId || null;
}
