import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ComponentStatus {
  name: string;
  configured: boolean;
  message: string;
}

const CHECK_TIMEOUT_MS = 5000;

// Helper to run command with timeout
function runCommand(cmd: string, args: string[] = [], timeoutMs: number = CHECK_TIMEOUT_MS): { stdout: string; stderr: string; success: boolean } | null {
  try {
    const result = spawnSync(cmd, args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      success: result.status === 0
    };
  } catch {
    return null;
  }
}

// Project-level paths in workspace/
const PROJECT_CLAUDE_DIR = resolve(process.cwd(), 'workspace', '.claude');
const PROJECT_SETTINGS_PATH = resolve(PROJECT_CLAUDE_DIR, 'settings.json');
const PROJECT_ENV_PATH = resolve(PROJECT_CLAUDE_DIR, '.env');

// Claude Code CLI status - check global installation only
export function checkClaudeCode(): ComponentStatus {
  const result = runCommand('claude', ['--version']);
  if (result && result.success) {
    const version = result.stdout.trim().split('\n')[0];
    return { name: 'Claude Code', configured: true, message: `${version} installed` };
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

// GitHub status - check if gh CLI is installed
export function checkGitHub(): ComponentStatus {
  const result = runCommand('gh', ['--version']);
  if (result && result.success) {
    const version = result.stdout.trim().split('\n')[0];
    return { name: 'GitHub', configured: true, message: `${version} installed` };
  }
  return { name: 'GitHub', configured: false, message: 'gh CLI not installed' };
}

// Get all statuses
export function getAllStatuses(): Record<string, ComponentStatus> {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();
  const github = checkGitHub();

  return { claude, feishu, github };
}
