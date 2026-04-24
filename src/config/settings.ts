import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = resolve(homedir(), '.claude');
const SETTINGS_PATH = resolve(CLAUDE_DIR, 'settings.json');

export interface ClaudeSettings {
  env?: Record<string, string>;
  enabledPlugins?: Record<string, boolean>;
}

export function loadSettings(): ClaudeSettings {
  if (!existsSync(SETTINGS_PATH)) {
    return {};
  }
  try {
    const content = readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function saveSettings(settings: ClaudeSettings): void {
  if (!existsSync(CLAUDE_DIR)) {
    require('fs').mkdirSync(CLAUDE_DIR, { recursive: true });
  }
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export function getClaudeApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN;
}

export function setClaudeApiKey(apiKey: string): void {
  const settings = loadSettings();
  if (!settings.env) {
    settings.env = {};
  }
  settings.env.ANTHROPIC_API_KEY = apiKey;
  saveSettings(settings);
}

export function resetClaudeApiKey(): void {
  const settings = loadSettings();
  if (settings.env) {
    delete settings.env.ANTHROPIC_API_KEY;
    delete settings.env.ANTHROPIC_AUTH_TOKEN;
  }
  saveSettings(settings);
}

// ECC Plugin
const PLUGINS_PATH = resolve(CLAUDE_DIR, 'plugins', 'installed_plugins.json');

export interface PluginInfo {
  version: string;
}

export interface PluginsConfig {
  plugins?: Record<string, PluginInfo[]>;
}

export function getEccPluginStatus(): { installed: boolean; version?: string } {
  if (!existsSync(PLUGINS_PATH)) {
    return { installed: false };
  }
  try {
    const content = readFileSync(PLUGINS_PATH, 'utf-8');
    const config: PluginsConfig = JSON.parse(content);
    const eccId = 'everything-claude-code@everything-claude-code';
    const plugin = config.plugins?.[eccId];
    if (plugin && plugin[0]) {
      return { installed: true, version: plugin[0].version };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}

// .env file management
const ENV_PATH = resolve(process.cwd(), '.env');

export function updateEnvFile(key: string, value: string): void {
  let content = '';
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, 'utf-8');
  }

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`${key}=${value}`);
  }

  writeFileSync(ENV_PATH, lines.join('\n'));
}

export function removeFromEnvFile(key: string): void {
  if (!existsSync(ENV_PATH)) {
    return;
  }

  const content = readFileSync(ENV_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => !line.startsWith(`${key}=`));

  writeFileSync(ENV_PATH, lines.join('\n'));
}

export function setFeishuCredentials(appId: string, appSecret: string): void {
  updateEnvFile('FEISHU_APP_ID', appId);
  updateEnvFile('FEISHU_APP_SECRET', appSecret);
}

export function resetFeishuCredentials(): void {
  removeFromEnvFile('FEISHU_APP_ID');
  removeFromEnvFile('FEISHU_APP_SECRET');
}
