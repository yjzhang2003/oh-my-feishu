import { execa } from 'execa';
import { resolve } from 'path';
import { env } from '../config/env.js';
import { readFileSync, existsSync } from 'fs';

export interface InvokeOptions {
  skill: string;
  timeout?: number; // milliseconds
}

export interface InvokeResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Read .env from workspace/.claude/.env and return as env vars object
function loadWorkspaceEnv(): Record<string, string> {
  const envPath = resolve(env.REPO_ROOT, 'workspace', '.claude', '.env');
  const vars: Record<string, string> = {};

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^(\w+)=(.+)$/);
        if (match) {
          vars[match[1]] = match[2].trim();
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return vars;
}

/**
 * Invoke Claude Code CLI with a skill
 *
 * Example:
 *   await invokeClaudeSkill({ skill: 'auto-repair' })
 */
export async function invokeClaudeSkill(options: InvokeOptions): Promise<InvokeResult> {
  const { skill, timeout = 300000 } = options; // Default 5 minute timeout
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  try {
    const workspaceEnv = loadWorkspaceEnv();
    // Skills are invoked via /skill-name, not --skill option
    const result = await execa('claude', ['-p', `/${skill}`], {
      cwd: workspaceDir,
      timeout,
      reject: false,
      env: { ...process.env, ...workspaceEnv },
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
    // Handle timeout or other errors
    if (error instanceof Error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
      };
    }
    return {
      success: false,
      stdout: '',
      stderr: 'Unknown error',
      exitCode: 1,
    };
  }
}

/**
 * Check if Claude CLI is available
 */
export async function checkClaudeCli(): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await execa('claude', ['--version']);
    const version = result.stdout.trim().split('\n')[0];
    return { available: true, version };
  } catch {
    return { available: false };
  }
}
