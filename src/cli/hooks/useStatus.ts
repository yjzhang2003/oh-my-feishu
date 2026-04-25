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
  const configResult = runCommand('lark-cli', ['config', 'show']);
  if (configResult && configResult.stdout) {
    try {
      // Output may have extra lines after JSON, extract JSON part
      const output = configResult.stdout.trim();
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = output.slice(jsonStart, jsonEnd + 1);
        const config = JSON.parse(jsonStr);
        const appId = config.appId || '';
        const brand = config.brand || 'feishu';
        if (appId) {
          return {
            name: 'Feishu',
            configured: true,
            message: `${brand}: ${appId.slice(0, 8)}...`
          };
        }
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

// Agent status - check if agent can start (all required components ready)
export function checkAgent(): ComponentStatus {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();

  if (!claude.configured) {
    return { name: 'Agent', configured: false, message: 'Claude CLI required' };
  }
  if (!feishu.configured) {
    return { name: 'Agent', configured: false, message: 'lark-cli required' };
  }
  return { name: 'Agent', configured: true, message: 'Ready to start' };
}

// Get all statuses
export function getAllStatuses(): Record<string, ComponentStatus> {
  const claude = checkClaudeCode();
  const feishu = checkFeishu();
  const github = checkGitHub();

  return { claude, feishu, github };
}
