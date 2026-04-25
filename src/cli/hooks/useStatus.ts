import { spawnSync } from 'child_process';

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

// Claude Code CLI status - check global installation only
export function checkClaudeCode(): ComponentStatus {
  const result = runCommand('claude', ['--version']);
  if (result && result.success) {
    const version = result.stdout.trim().split('\n')[0];
    return { name: 'Claude Code', configured: true, message: `${version} installed` };
  }
  return { name: 'Claude Code', configured: false, message: 'CLI not installed' };
}

// Feishu/Lark status - check lark-cli configuration
export function checkFeishu(): ComponentStatus {
  // First check if lark-cli is installed
  const larkResult = runCommand('lark-cli', ['--version']);
  if (!larkResult || !larkResult.success) {
    return { name: 'Feishu', configured: false, message: 'lark-cli not installed' };
  }

  // Check if lark-cli is configured
  const configResult = runCommand('lark-cli', ['config', 'show', '--format', 'json']);
  if (configResult && configResult.success && configResult.stdout) {
    try {
      const config = JSON.parse(configResult.stdout);
      const appId = config.app_id || '';
      const brand = config.brand || 'feishu';
      if (appId) {
        return {
          name: 'Feishu',
          configured: true,
          message: `${brand}: ${appId.slice(0, 8)}...`
        };
      }
    } catch {
      // Config not valid JSON
    }
  }

  return { name: 'Feishu', configured: false, message: 'lark-cli not configured' };
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

// Lark CLI status - check if lark-cli is installed
export function checkLarkCli(): ComponentStatus {
  const result = runCommand('lark', ['--version']);
  if (result && result.success) {
    const version = result.stdout.trim().split('\n')[0];
    return { name: 'Lark CLI', configured: true, message: `${version} installed` };
  }
  return { name: 'Lark CLI', configured: false, message: 'lark-cli not installed' };
}

// Gateway status - check if gateway is running
export function checkGateway(): ComponentStatus {
  const result = runCommand('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8000/health']);
  if (result && result.success && result.stdout.trim() === '200') {
    return { name: 'Gateway', configured: true, message: 'Running on :8000' };
  }
  return { name: 'Gateway', configured: false, message: 'Not running' };
}

// Get all statuses
export function getAllStatuses(): Record<string, ComponentStatus> {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();
  const github = checkGitHub();
  const lark = checkLarkCli();
  const gateway = checkGateway();

  return { claude, feishu, github, lark, gateway };
}
