import qrcode from 'qrcode';

const ACCOUNTS_URLS: Record<string, string> = {
  feishu: 'https://accounts.feishu.cn',
  lark: 'https://accounts.larksuite.com',
};

const REGISTRATION_PATH = '/oauth/v1/app/registration';

export interface BeginResult {
  device_code: string;
  qr_url: string;
  user_code: string;
  interval: number;
  expire_in: number;
}

export interface RegisterResult {
  app_id: string;
  app_secret: string;
  domain: string;
  open_id?: string;
}

export interface QrStatus {
  phase: 'connecting' | 'waiting' | 'success' | 'denied' | 'expired' | 'timeout' | 'error';
  message: string;
  qrString?: string;
  qrUrl?: string;
  result?: RegisterResult;
}

async function postRegistration(baseUrl: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const formBody = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      formBody.append(key, String(value));
    }
  }

  const response = await fetch(`${baseUrl}${REGISTRATION_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function initRegistration(domain: string): Promise<void> {
  const baseUrl = ACCOUNTS_URLS[domain] || ACCOUNTS_URLS.feishu;
  const res = await postRegistration(baseUrl, { action: 'init' });
  const methods = (res.supported_auth_methods as string[]) || [];

  if (!methods.includes('client_secret')) {
    throw new Error(`Feishu registration environment does not support client_secret auth. Supported: ${methods.join(', ')}`);
  }
}

export async function beginRegistration(domain: string): Promise<BeginResult> {
  const baseUrl = ACCOUNTS_URLS[domain] || ACCOUNTS_URLS.feishu;
  const res = await postRegistration(baseUrl, {
    action: 'begin',
    archetype: 'PersonalAgent',
    auth_method: 'client_secret',
    request_user_info: 'open_id',
  });

  const deviceCode = res.device_code as string;
  if (!deviceCode) {
    throw new Error('Feishu registration did not return a device_code');
  }

  let qrUrl = (res.verification_uri_complete as string) || '';
  if (qrUrl.includes('?')) {
    qrUrl += '&from=feishu-agent&tp=feishu-agent';
  } else {
    qrUrl += '?from=feishu-agent&tp=feishu-agent';
  }

  return {
    device_code: deviceCode,
    qr_url: qrUrl,
    user_code: (res.user_code as string) || '',
    interval: (res.interval as number) || 5,
    expire_in: (res.expire_in as number) || 600,
  };
}

export async function pollOnce(
  deviceCode: string,
  domain: string
): Promise<{ status: 'pending' | 'success' | 'denied' | 'expired'; result?: RegisterResult; newDomain?: string }> {
  const baseUrl = ACCOUNTS_URLS[domain] || ACCOUNTS_URLS.feishu;

  try {
    const res = await postRegistration(baseUrl, {
      action: 'poll',
      device_code: deviceCode,
      tp: 'ob_app',
    });

    // Domain auto-detection
    const userInfo = (res.user_info as Record<string, unknown>) || {};
    const tenantBrand = userInfo.tenant_brand as string;
    const newDomain = tenantBrand === 'lark' ? 'lark' : undefined;

    // Success
    if (res.client_id && res.client_secret) {
      return {
        status: 'success',
        result: {
          app_id: res.client_id as string,
          app_secret: res.client_secret as string,
          domain: newDomain || domain,
          open_id: userInfo.open_id as string,
        },
      };
    }

    // Terminal errors
    const error = res.error as string;
    if (error === 'access_denied') {
      return { status: 'denied' };
    }
    if (error === 'expired_token') {
      return { status: 'expired' };
    }

    return { status: 'pending', newDomain };
  } catch {
    return { status: 'pending' };
  }
}

export async function generateQrString(url: string): Promise<string> {
  return qrcode.toString(url, {
    type: 'terminal',
    small: true,
  });
}
