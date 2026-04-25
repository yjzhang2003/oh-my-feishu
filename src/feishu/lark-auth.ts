import { spawn } from 'child_process';
import { createInterface } from 'readline';

export interface LarkInitResult {
  success: boolean;
  error?: string;
  hint?: string;
}

export interface LarkConfigStatus {
  configured: boolean;
  appId?: string;
  brand?: string;
  error?: string;
}

/**
 * Parse lark-cli config init --new output to extract verification URL
 */
export function parseInitOutput(output: string): { url: string; userCode: string } | null {
  // Match URL like: https://open.feishu.cn/page/cli?user_code=XXXX
  const urlMatch = output.match(/https:\/\/open\.(feishu|larksuite)\.cn\/page\/cli\?user_code=[A-Z0-9-]+/);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  const userCodeMatch = url.match(/user_code=([A-Z0-9-]+)/);
  const userCode = userCodeMatch ? userCodeMatch[1] : '';

  return { url, userCode };
}

/**
 * Check if lark-cli is configured
 */
export async function checkLarkConfig(): Promise<LarkConfigStatus> {
  return new Promise((resolve) => {
    const proc = spawn('lark-cli', ['config', 'show'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          // Output may have extra lines after JSON, extract JSON part
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const jsonStr = stdout.slice(jsonStart, jsonEnd + 1);
            const config = JSON.parse(jsonStr);
            resolve({
              configured: true,
              appId: config.appId,
              brand: config.brand,
            });
          } else {
            resolve({ configured: false, error: 'Failed to parse config' });
          }
        } catch {
          resolve({ configured: false, error: 'Failed to parse config' });
        }
      } else {
        // Check for "not configured" error
        if (stderr.includes('not configured') || stdout.includes('not configured')) {
          resolve({ configured: false });
        } else {
          resolve({ configured: false, error: stderr || 'Unknown error' });
        }
      }
    });

    proc.on('error', (err) => {
      resolve({ configured: false, error: err.message });
    });
  });
}

/**
 * Run lark-cli config init --new and capture output
 * Returns an async generator that yields output lines
 */
export async function* runLarkInit(): AsyncGenerator<
  { type: 'url'; url: string; userCode: string } | { type: 'output'; line: string } | { type: 'done'; success: boolean; error?: string }
> {
  return new Promise<AsyncGenerator<never>>((resolve, reject) => {
    const proc = spawn('lark-cli', ['config', 'init', '--new'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // Try to parse URL from output
      const parsed = parseInitOutput(output);
      if (parsed && !resolved) {
        resolved = true;
        // Emit URL event
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Success
      } else {
        // Failed
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Initialize lark-cli config interactively
 * Returns the verification URL for the user to open
 */
export async function initLarkConfig(
  onOutput: (line: string) => void
): Promise<{ success: boolean; url?: string; userCode?: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('lark-cli', ['config', 'init', '--new'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let urlFound = false;

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      onOutput(output);

      // Parse URL from output
      if (!urlFound) {
        const parsed = parseInitOutput(output);
        if (parsed) {
          urlFound = true;
          // URL found but don't resolve yet - wait for process to complete
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      onOutput(data.toString());
    });

    proc.on('close', (code) => {
      const parsed = parseInitOutput(stdout);

      if (code === 0) {
        resolve({
          success: true,
          url: parsed?.url,
          userCode: parsed?.userCode,
        });
      } else {
        resolve({
          success: false,
          error: stderr || `Process exited with code ${code}`,
          url: parsed?.url,
          userCode: parsed?.userCode,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

/**
 * Remove lark-cli configuration
 */
export async function removeLarkConfig(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('lark-cli', ['config', 'remove'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || stdout || `Process exited with code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}
