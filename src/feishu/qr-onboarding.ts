/**
 * Feishu/Lark QR Scan-to-Create Registration
 *
 * Device-code flow: user scans a QR code with Feishu/Lark mobile app and
 * the platform creates a fully configured bot application automatically.
 *
 * Reference: Hermes gateway/platforms/feishu.py
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const ACCOUNTS_URLS = {
  feishu: 'https://accounts.feishu.cn',
  lark: 'https://accounts.larksuite.com',
};

const OPEN_URLS = {
  feishu: 'https://open.feishu.cn',
  lark: 'https://open.larksuite.com',
};

const REGISTRATION_PATH = '/oauth/v1/app/registration';
const REQUEST_TIMEOUT_MS = 10000;

export interface QRRegistrationResult {
  success: boolean;
  appId?: string;
  appSecret?: string;
  domain?: string;
  openId?: string;
  botName?: string;
  error?: string;
}

export interface QRBeginResult {
  deviceCode: string;
  qrUrl: string;
  userCode: string;
  interval: number;
  expireIn: number;
}

/**
 * POST form-encoded data to the registration endpoint
 */
async function postRegistration(domain: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const baseUrl = ACCOUNTS_URLS[domain as keyof typeof ACCOUNTS_URLS] || ACCOUNTS_URLS.feishu;
  const url = `${baseUrl}${REGISTRATION_PATH}`;

  const formData = new URLSearchParams(body).toString();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

/**
 * Initialize registration - verify environment supports client_secret auth
 */
export async function initRegistration(domain: string = 'feishu'): Promise<boolean> {
  const res = await postRegistration(domain, { action: 'init' });
  const methods = (res.supported_auth_methods as string[]) || [];
  return methods.includes('client_secret');
}

/**
 * Begin registration - start device code flow
 */
export async function beginRegistration(domain: string = 'feishu'): Promise<QRBeginResult> {
  const res = await postRegistration(domain, {
    action: 'begin',
    archetype: 'PersonalAgent',
    auth_method: 'client_secret',
    request_user_info: 'open_id',
  });

  const deviceCode = res.device_code as string;
  if (!deviceCode) {
    throw new Error('Registration did not return device_code');
  }

  let qrUrl = (res.verification_uri_complete as string) || '';
  if (qrUrl) {
    qrUrl += qrUrl.includes('?') ? '&from=feishu-agent' : '?from=feishu-agent';
  }

  return {
    deviceCode,
    qrUrl,
    userCode: (res.user_code as string) || '',
    interval: (res.interval as number) || 5,
    expireIn: (res.expire_in as number) || 600,
  };
}

/**
 * Poll registration - wait for user to scan QR code
 */
export async function pollRegistration(
  deviceCode: string,
  domain: string = 'feishu'
): Promise<QRRegistrationResult> {
  try {
    const res = await postRegistration(domain, {
      action: 'poll',
      device_code: deviceCode,
      tp: 'ob_app',
    });

    // Check for errors
    const error = res.error as string;
    if (error === 'authorization_pending') {
      return { success: false, error: 'pending' };
    }
    if (error === 'expired_token') {
      return { success: false, error: 'expired' };
    }
    if (error === 'access_denied') {
      return { success: false, error: 'denied' };
    }
    if (error) {
      return { success: false, error };
    }

    // Success - extract credentials
    // Note: API returns client_id/client_secret, not app_id/app_secret
    const appId = (res.client_id || res.app_id) as string;
    const appSecret = (res.client_secret || res.app_secret) as string;
    const userInfo = res.user_info as { open_id?: string } || {};
    const openId = userInfo.open_id || res.open_id as string;

    if (!appId || !appSecret) {
      return { success: false, error: 'Missing client_id or client_secret in response' };
    }

    return {
      success: true,
      appId,
      appSecret,
      domain,
      openId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Run the complete QR registration flow with progress callback
 */
export async function qrRegister(
  domain: string = 'feishu',
  onProgress: (status: string) => void,
  timeoutSeconds: number = 600
): Promise<QRRegistrationResult> {
  try {
    // Step 1: Initialize
    onProgress('Connecting to Feishu...');
    const supported = await initRegistration(domain);
    if (!supported) {
      return { success: false, error: 'client_secret auth not supported' };
    }

    // Step 2: Begin registration
    onProgress('Generating QR code...');
    const begin = await beginRegistration(domain);

    // Return QR URL for display
    return {
      success: false,
      error: 'qr_display',
      appId: begin.qrUrl,
      appSecret: begin.userCode,
      domain: begin.deviceCode, // Temporarily store device_code here
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Continue polling after QR is displayed
 */
export async function continueQRPolling(
  deviceCode: string,
  domain: string = 'feishu',
  intervalSeconds: number = 5,
  timeoutSeconds: number = 600,
  onPoll?: (attempt: number) => void
): Promise<QRRegistrationResult> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    onPoll?.(attempt);

    const result = await pollRegistration(deviceCode, domain);

    if (result.success) {
      // Save credentials to lark-cli config
      await saveLarkConfig(result.appId!, result.appSecret!, domain);
      return result;
    }

    if (result.error !== 'pending') {
      return result;
    }

    // Wait for interval
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }

  return { success: false, error: 'Timeout waiting for QR scan' };
}

/**
 * Save credentials to lark-cli compatible config
 */
async function saveLarkConfig(appId: string, appSecret: string, domain: string): Promise<void> {
  const configDir = join(homedir(), '.lark-cli');
  const configPath = join(configDir, 'config.json');

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config = {
    apps: [
      {
        appId,
        appSecret,
        brand: domain,
        lang: 'zh',
        users: [],
      },
    ],
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Render QR code as ASCII art (requires qrcode package)
 */
export async function renderQRAscii(url: string): Promise<string[]> {
  try {
    // Try to use qrcode package if available
    const QRCode = await import('qrcode').catch(() => null);
    if (QRCode) {
      const lines: string[] = [];
      const qr = QRCode.default.create(url, { errorCorrectionLevel: 'M' });

      // Generate ASCII representation
      const modules = qr.modules;
      const size = modules.size;

      for (let row = 0; row < size; row++) {
        let line = '';
        for (let col = 0; col < size; col++) {
          line += modules.get(row, col) ? '██' : '  ';
        }
        lines.push(line);
      }

      return lines;
    }
  } catch {
    // QRCode package not available
  }

  return [];
}
