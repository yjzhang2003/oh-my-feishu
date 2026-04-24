import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

export interface ComponentStatus {
  name: string;
  configured: boolean;
  message: string;
}

// Claude Code CLI status
export function checkClaudeCode(): ComponentStatus {
  try {
    const version = execSync('claude --version', { encoding: 'utf-8' }).trim().split('\n')[0];

    // Check for API key
    const settingsPath = resolve(homedir(), '.claude', 'settings.json');
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      const hasKey = settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN;
      if (hasKey) {
        return { name: 'Claude Code', configured: true, message: `${version} - API configured` };
      }
    }

    return { name: 'Claude Code', configured: false, message: 'API key not configured' };
  } catch {
    return { name: 'Claude Code', configured: false, message: 'CLI not installed' };
  }
}

// Feishu status
export function checkFeishu(): ComponentStatus {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return { name: 'Feishu', configured: false, message: 'No .env file' };
  }

  const content = readFileSync(envPath, 'utf-8');
  const hasAppId = /FEISHU_APP_ID=.+/.test(content);
  const hasSecret = /FEISHU_APP_SECRET=.+/.test(content);

  if (hasAppId && hasSecret) {
    // Extract app_id for display
    const match = content.match(/FEISHU_APP_ID=(.+)/);
    const appId = match ? match[1].trim() : '';
    return { name: 'Feishu', configured: true, message: `Bot: ${appId.slice(0, 8)}...` };
  }

  return { name: 'Feishu', configured: false, message: 'Bot credentials not configured' };
}

// GitHub status
export function checkGitHub(): ComponentStatus {
  try {
    const result = execSync('gh auth status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

    // Extract username
    const match = result.match(/Logged in to github\.com as (\S+)/);
    if (match) {
      return { name: 'GitHub', configured: true, message: `Authenticated as ${match[1]}` };
    }

    return { name: 'GitHub', configured: false, message: 'Not authenticated' };
  } catch {
    return { name: 'GitHub', configured: false, message: 'Not authenticated' };
  }
}

// ECC plugin status
export function checkECC(): ComponentStatus {
  const pluginsPath = resolve(homedir(), '.claude', 'plugins', 'installed_plugins.json');

  if (!existsSync(pluginsPath)) {
    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  }

  try {
    const content = readFileSync(pluginsPath, 'utf-8');
    const plugins = JSON.parse(content).plugins || {};

    const eccId = 'everything-claude-code@everything-claude-code';
    if (plugins[eccId] && plugins[eccId][0]) {
      const version = plugins[eccId][0].version;
      return { name: 'ECC', configured: true, message: `Plugin v${version} installed` };
    }

    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  } catch {
    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  }
}

// Get all statuses
export function getAllStatuses(): Record<string, ComponentStatus> {
  return {
    claude: checkClaudeCode(),
    feishu: checkFeishu(),
    github: checkGitHub(),
    ecc: checkECC(),
  };
}
