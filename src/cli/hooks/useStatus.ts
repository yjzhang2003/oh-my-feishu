import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

export interface ServiceStatus {
  name: string;
  running: boolean;
  status: string;
  uptime?: string;
  memory?: string;
  cpu?: string;
  restarts?: number;
}

export interface ComponentStatus {
  name: string;
  configured: boolean;
  message: string;
}

const CHECK_TIMEOUT_MS = 5000;

function isUsableAppSecret(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && !value.includes('*');
}

function readUsableFeishuConfig(): { appId: string; brand: string } | null {
  const configPaths = [
    resolve(homedir(), '.lark-cli', 'config.json'),
    resolve(homedir(), '.config', 'lark-cli', 'config.json'),
    resolve(homedir(), 'Library', 'Application Support', 'lark-cli', 'config.json'),
  ];

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const appConfig = config.apps?.[0] || config;
      if (appConfig.appId && isUsableAppSecret(appConfig.appSecret)) {
        return {
          appId: appConfig.appId,
          brand: appConfig.brand || 'feishu',
        };
      }
    } catch {
      // Try the next known location.
    }
  }

  return null;
}

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

// Claude Code CLI status - check global installation only
export function checkClaudeCode(): ComponentStatus {
  const result = runCommand('claude', ['--version']);
  if (result && result.success) {
    const version = result.stdout.trim().split('\n')[0];
    return { name: 'Claude Code', configured: true, message: `${version} installed` };
  }
  return { name: 'Claude Code', configured: false, message: 'CLI not installed' };
}

// Feishu/Lark status - require QR-compatible credentials with a usable appSecret.
export function checkFeishu(): ComponentStatus {
  // First check if lark-cli is installed
  const larkResult = runCommand('lark-cli', ['--version']);
  if (!larkResult || !larkResult.success) {
    return { name: 'Feishu', configured: false, message: 'lark-cli not installed' };
  }

  const config = readUsableFeishuConfig();
  if (config) {
    return {
      name: 'Feishu',
      configured: true,
      message: `${config.brand}: ${config.appId.slice(0, 8)}...`
    };
  }

  return { name: 'Feishu', configured: false, message: 'QR auth required' };
}

// Agent status - check if agent can start (all required components ready)
export function checkAgent(): ComponentStatus {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();

  if (!claude.configured) {
    return { name: 'Agent', configured: false, message: 'Claude CLI required' };
  }
  if (!feishu.configured) {
    return { name: 'Agent', configured: false, message: 'Feishu QR auth required' };
  }
  return { name: 'Agent', configured: true, message: 'Ready to start' };
}

// Get all statuses
export function getAllStatuses(): Record<string, ComponentStatus> {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();

  return { claude, feishu };
}

// Check if PM2 is installed
export function checkPM2(): boolean {
  const result = runCommand('pm2', ['--version']);
  return result !== null && result.success;
}

// Get oh-my-feishu service status from PM2
export function checkService(): ServiceStatus {
  // First check PM2 is installed
  if (!checkPM2()) {
    return {
      name: 'oh-my-feishu',
      running: false,
      status: 'PM2 not installed',
    };
  }

  // Use pm2 jlist for JSON output
  const result = runCommand('pm2', ['jlist']);
  if (!result || !result.success) {
    return {
      name: 'oh-my-feishu',
      running: false,
      status: 'Failed to get PM2 status',
    };
  }

  try {
    const processes = JSON.parse(result.stdout);
    const agent = processes.find((p: { name: string }) => p.name === 'oh-my-feishu');

    if (!agent) {
      return {
        name: 'oh-my-feishu',
        running: false,
        status: 'Not started',
      };
    }

    const status = agent.pm2_env?.status || 'unknown';
    const running = status === 'online';

    return {
      name: 'oh-my-feishu',
      running,
      status: running ? 'Running' : status,
      uptime: running ? formatUptime(agent.pm2_env?.pm_uptime) : undefined,
      memory: agent.monit?.memory ? formatMemory(agent.monit.memory) : undefined,
      cpu: agent.monit?.cpu !== undefined ? `${agent.monit.cpu}%` : undefined,
      restarts: agent.pm2_env?.restart_time,
    };
  } catch {
    return {
      name: 'oh-my-feishu',
      running: false,
      status: 'Failed to parse PM2 output',
    };
  }
}

function formatUptime(uptimeMs: number | undefined): string {
  if (!uptimeMs) return 'N/A';
  const seconds = Math.floor((Date.now() - uptimeMs) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
