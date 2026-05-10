import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { buildToolPathEnv, resolveLarkCliBin } from '../utils/tool-paths.js';

export interface LarkConfigStatus {
  configured: boolean;
  appId?: string;
  brand?: string;
  error?: string;
}

function isUsableAppSecret(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && !value.includes('*');
}

/**
 * Check if QR-compatible Feishu credentials are configured.
 */
export async function checkLarkConfig(): Promise<LarkConfigStatus> {
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
          configured: true,
          appId: appConfig.appId,
          brand: appConfig.brand,
        };
      }
    } catch {
      // Try the next known location.
    }
  }

  return { configured: false, error: 'QR auth required' };
}

/**
 * Remove lark-cli configuration
 */
export async function removeLarkConfig(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(resolveLarkCliBin(), ['config', 'remove'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: buildToolPathEnv(),
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
