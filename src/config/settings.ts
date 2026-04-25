import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

// Project-level .claude directory
const PROJECT_CLAUDE_DIR = resolve(process.cwd(), '.claude');
const PROJECT_SETTINGS_PATH = resolve(PROJECT_CLAUDE_DIR, 'settings.json');
const PROJECT_ENV_PATH = resolve(PROJECT_CLAUDE_DIR, '.env');

// ECC plugin ID
const ECC_PLUGIN_ID = 'oh-my-claudecode@omc';

export interface ClaudeSettings {
  env?: Record<string, string>;
  enabledPlugins?: Record<string, boolean>;
}

// Ensure .claude directory exists
function ensureClaudeDir(): void {
  if (!existsSync(PROJECT_CLAUDE_DIR)) {
    mkdirSync(PROJECT_CLAUDE_DIR, { recursive: true });
  }
}

// Load project-level settings
export function loadSettings(): ClaudeSettings {
  if (!existsSync(PROJECT_SETTINGS_PATH)) {
    return {};
  }
  try {
    const content = readFileSync(PROJECT_SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Save project-level settings
export function saveSettings(settings: ClaudeSettings): void {
  ensureClaudeDir();
  writeFileSync(PROJECT_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Get Claude API key
export function getClaudeApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN;
}

// Set Claude API key
export function setClaudeApiKey(apiKey: string): void {
  const settings = loadSettings();
  if (!settings.env) {
    settings.env = {};
  }
  settings.env.ANTHROPIC_API_KEY = apiKey;
  saveSettings(settings);
}

// Reset Claude API key
export function resetClaudeApiKey(): void {
  const settings = loadSettings();
  if (settings.env) {
    delete settings.env.ANTHROPIC_API_KEY;
    delete settings.env.ANTHROPIC_AUTH_TOKEN;
  }
  saveSettings(settings);
}

// ECC Plugin - check if enabled in project settings
export function getEccPluginStatus(): { installed: boolean; version?: string } {
  const settings = loadSettings();
  const isEnabled = settings.enabledPlugins?.[ECC_PLUGIN_ID] === true;

  if (isEnabled) {
    return { installed: true, version: 'enabled' };
  }

  // Fallback: check global installation
  const globalPluginsPath = resolve(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (existsSync(globalPluginsPath)) {
    try {
      const content = readFileSync(globalPluginsPath, 'utf-8');
      const config = JSON.parse(content);
      const plugins = config.plugins || {};

      // Check for ECC plugin variants
      for (const pluginId of Object.keys(plugins)) {
        if (pluginId.includes('oh-my-claudecode') || pluginId.includes('everything-claude-code')) {
          const plugin = plugins[pluginId];
          if (plugin && plugin[0]) {
            return { installed: true, version: plugin[0].version };
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return { installed: false };
}

// Enable ECC plugin in project settings
export function enableEccPlugin(): void {
  const settings = loadSettings();
  if (!settings.enabledPlugins) {
    settings.enabledPlugins = {};
  }
  settings.enabledPlugins[ECC_PLUGIN_ID] = true;
  saveSettings(settings);
}

// Disable ECC plugin in project settings
export function disableEccPlugin(): void {
  const settings = loadSettings();
  if (settings.enabledPlugins) {
    delete settings.enabledPlugins[ECC_PLUGIN_ID];
  }
  saveSettings(settings);
}

// .env file management in .claude directory
function updateEnvFile(key: string, value: string): void {
  ensureClaudeDir();

  let content = '';
  if (existsSync(PROJECT_ENV_PATH)) {
    content = readFileSync(PROJECT_ENV_PATH, 'utf-8');
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

  writeFileSync(PROJECT_ENV_PATH, lines.join('\n'));
}

function removeFromEnvFile(key: string): void {
  if (!existsSync(PROJECT_ENV_PATH)) {
    return;
  }

  const content = readFileSync(PROJECT_ENV_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => !line.startsWith(`${key}=`));

  writeFileSync(PROJECT_ENV_PATH, lines.join('\n'));
}

// Feishu credentials
export function setFeishuCredentials(appId: string, appSecret: string): void {
  updateEnvFile('FEISHU_APP_ID', appId);
  updateEnvFile('FEISHU_APP_SECRET', appSecret);
}

export function resetFeishuCredentials(): void {
  removeFromEnvFile('FEISHU_APP_ID');
  removeFromEnvFile('FEISHU_APP_SECRET');
}
