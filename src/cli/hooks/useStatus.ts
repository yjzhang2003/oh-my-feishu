import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

export interface ComponentStatus {
  name: string;
  configured: boolean;
  message: string;
}

const CHECK_TIMEOUT_MS = 3000;

// Helper to run command with timeout
function runCommand(cmd: string, timeoutMs: number = CHECK_TIMEOUT_MS): { stdout: string; stderr: string; success: boolean } | null {
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout: result, stderr: '', success: true };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    // Return output even on failure (gh auth status writes to stderr on success)
    if (execError.stdout || execError.stderr) {
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        success: false
      };
    }
    return null;
  }
}

// Project-level paths in workspace/
const PROJECT_CLAUDE_DIR = resolve(process.cwd(), 'workspace', '.claude');
const PROJECT_SETTINGS_PATH = resolve(PROJECT_CLAUDE_DIR, 'settings.json');
const PROJECT_ENV_PATH = resolve(PROJECT_CLAUDE_DIR, '.env');

// Claude Code CLI status - check project-level settings
export function checkClaudeCode(): ComponentStatus {
  // Check project-level settings first
  if (existsSync(PROJECT_SETTINGS_PATH)) {
    try {
      const content = readFileSync(PROJECT_SETTINGS_PATH, 'utf-8');
      const settings = JSON.parse(content);
      const hasKey = settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN;

      if (hasKey) {
        // Check if claude CLI is installed
        const result = runCommand('claude --version');
        const version = result ? result.stdout.trim().split('\n')[0] : 'CLI';
        return { name: 'Claude Code', configured: true, message: `${version} - API configured` };
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check if CLI is installed at least
  const result = runCommand('claude --version');
  if (result) {
    return { name: 'Claude Code', configured: false, message: 'API key not configured' };
  }

  return { name: 'Claude Code', configured: false, message: 'CLI not installed' };
}

// Feishu status - check project-level .env in .claude directory
export function checkFeishu(): ComponentStatus {
  if (!existsSync(PROJECT_ENV_PATH)) {
    // Fallback to root .env for backwards compatibility
    const rootEnvPath = resolve(process.cwd(), '.env');
    if (!existsSync(rootEnvPath)) {
      return { name: 'Feishu', configured: false, message: 'No .env file' };
    }

    try {
      const content = readFileSync(rootEnvPath, 'utf-8');
      const hasAppId = /FEISHU_APP_ID=.+/.test(content);
      const hasSecret = /FEISHU_APP_SECRET=.+/.test(content);

      if (hasAppId && hasSecret) {
        const match = content.match(/FEISHU_APP_ID=(.+)/);
        const appId = match ? match[1].trim() : '';
        return { name: 'Feishu', configured: true, message: `Bot: ${appId.slice(0, 8)}...` };
      }
    } catch {
      // Ignore errors
    }

    return { name: 'Feishu', configured: false, message: 'Bot credentials not configured' };
  }

  try {
    const content = readFileSync(PROJECT_ENV_PATH, 'utf-8');
    const hasAppId = /FEISHU_APP_ID=.+/.test(content);
    const hasSecret = /FEISHU_APP_SECRET=.+/.test(content);

    if (hasAppId && hasSecret) {
      const match = content.match(/FEISHU_APP_ID=(.+)/);
      const appId = match ? match[1].trim() : '';
      return { name: 'Feishu', configured: true, message: `Bot: ${appId.slice(0, 8)}...` };
    }

    return { name: 'Feishu', configured: false, message: 'Bot credentials not configured' };
  } catch {
    return { name: 'Feishu', configured: false, message: 'Cannot read .env' };
  }
}

// GitHub status - global check
export function checkGitHub(): ComponentStatus {
  const result = runCommand('gh auth status');

  if (!result) {
    return { name: 'GitHub', configured: false, message: 'Not authenticated' };
  }

  // gh auth status outputs to both stdout and stderr
  const output = result.stdout + result.stderr;

  // Extract username - match "Logged in to github.com account xxx" format
  const match = output.match(/Logged in to github\.com account (\S+)/);
  if (match) {
    return { name: 'GitHub', configured: true, message: `Authenticated as ${match[1]}` };
  }

  return { name: 'GitHub', configured: false, message: 'Not authenticated' };
}

// ECC plugin status - check project-level enabledPlugins
export function checkECC(): ComponentStatus {
  // Check project-level settings for enabledPlugins
  if (existsSync(PROJECT_SETTINGS_PATH)) {
    try {
      const content = readFileSync(PROJECT_SETTINGS_PATH, 'utf-8');
      const settings = JSON.parse(content);

      // Check if ECC is enabled in project settings
      const enabledPlugins = settings.enabledPlugins || {};
      for (const pluginId of Object.keys(enabledPlugins)) {
        if ((pluginId.includes('oh-my-claudecode') || pluginId.includes('everything-claude-code')) && enabledPlugins[pluginId]) {
          return { name: 'ECC', configured: true, message: 'Plugin enabled' };
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Fallback: check global installation
  const pluginsPath = resolve(homedir(), '.claude', 'plugins', 'installed_plugins.json');

  if (!existsSync(pluginsPath)) {
    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  }

  try {
    const content = readFileSync(pluginsPath, 'utf-8');
    const plugins = JSON.parse(content).plugins || {};

    for (const pluginId of Object.keys(plugins)) {
      if (pluginId.includes('oh-my-claudecode') || pluginId.includes('everything-claude-code')) {
        if (plugins[pluginId] && plugins[pluginId][0]) {
          return { name: 'ECC', configured: true, message: `Plugin v${plugins[pluginId][0].version} installed` };
        }
      }
    }

    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  } catch {
    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  }
}

// Get all statuses
export function getAllStatuses(): Record<string, ComponentStatus> {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();
  const github = checkGitHub();
  const ecc = checkECC();

  return { claude, feishu, github, ecc };
}
