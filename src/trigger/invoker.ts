import { execa } from 'execa';
import { resolve } from 'path';
import { env } from '../config/env.js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { readTrigger } from './trigger.js';
import { getService } from '../service/registry.js';

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

export interface ChatContext {
  message: string;
  chatId: string;
  senderOpenId: string;
  chatType: string;
  messageId?: string;
  directory?: string;
  sessionId?: string;
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

// Read service-specific env vars from the trigger's service_name field
function loadServiceEnv(): Record<string, string> {
  const vars: Record<string, string> = {};

  try {
    const trigger = readTrigger();
    if (trigger?.service_name) {
      const service = getService(trigger.service_name);
      if (service) {
        vars.GITHUB_REPO_OWNER = service.githubOwner;
        vars.GITHUB_REPO_NAME = service.githubRepo;
        vars.TRACEBACK_URL = service.tracebackUrl;
        vars.SERVICE_NAME = service.name;
        vars.NOTIFY_CHAT_ID = service.notifyChatId;
      }
    }
  } catch {
    // Ignore — service env is optional
  }

  return vars;
}

/**
 * Generate a deterministic UUID from chat ID for session persistence
 */
function chatIdToSessionUuid(chatId: string): string {
  // Create a hash of the chat ID
  const hash = createHash('sha256').update(chatId).digest('hex');
  // Format as valid UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // 8-4-4-4-12 = 32 hex chars + 4 dashes = 36 chars
  // y must be one of 8, 9, a, or b
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-${(parseInt(hash.slice(15, 16), 16) & 0x3 | 0x8).toString(16)}${hash.slice(16, 19)}-${hash.slice(19, 31)}`;
}

/**
 * Invoke Claude Code CLI with a skill
 */
export async function invokeClaudeSkill(options: InvokeOptions): Promise<InvokeResult> {
  const { skill, timeout = 300000 } = options;
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  try {
    const workspaceEnv = loadWorkspaceEnv();
    const serviceEnv = loadServiceEnv();
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      `/${skill}`,
    ], {
      cwd: workspaceDir,
      timeout,
      reject: false,
      stdin: 'ignore',
      env: { ...process.env, ...workspaceEnv, ...serviceEnv },
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
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
 * Invoke Claude Code directly with a chat message
 * Uses skills to teach Claude how to respond via lark-cli
 * Each chat ID gets its own session for context continuity
 */
export async function invokeClaudeChat(context: ChatContext, timeout: number = 300000): Promise<InvokeResult> {
  const cwd = context.directory
    ? resolve(context.directory)
    : resolve(env.REPO_ROOT, 'workspace');

  // Pass context as environment variables for the skill to use
  const contextEnv = {
    FEISHU_CHAT_ID: context.chatId,
    FEISHU_SENDER_OPEN_ID: context.senderOpenId,
    FEISHU_CHAT_TYPE: context.chatType,
    ...(context.messageId ? { FEISHU_MESSAGE_ID: context.messageId } : {}),
  };

  // Use provided sessionId or generate from chatId
  const sessionId = context.sessionId || chatIdToSessionUuid(context.chatId);

  // Prepend lark-chat-guide reference so Claude knows to reply via lark-cli
  const prompt = `回复用户前请阅读 lark-chat-guide 技能了解回复规则。\n\n${context.message}`;

  try {
    const workspaceEnv = loadWorkspaceEnv();

    // Build claude arguments
    const claudeArgs: string[] = ['-p', '--dangerously-skip-permissions'];
    if (context.directory) {
      claudeArgs.unshift('-C', context.directory);
    }
    claudeArgs.push('--resume', sessionId, prompt);

    const result = await execa('claude', claudeArgs, {
      cwd,
      timeout,
      reject: false,
      stdin: 'ignore',
      env: { ...process.env, ...workspaceEnv, ...contextEnv },
    });

    // If session not found, retry without --resume (session may have been lost after re-auth)
    if (result.stderr?.includes('No conversation found with session ID')) {
      const retryArgs: string[] = ['-p', '--dangerously-skip-permissions'];
      if (context.directory) {
        retryArgs.unshift('-C', context.directory);
      }
      retryArgs.push(prompt);

      const retryResult = await execa('claude', retryArgs, {
        cwd,
        timeout,
        reject: false,
        stdin: 'ignore',
        env: { ...process.env, ...workspaceEnv, ...contextEnv },
      });
      return {
        success: retryResult.exitCode === 0,
        stdout: retryResult.stdout,
        stderr: retryResult.stderr,
        exitCode: retryResult.exitCode ?? 1,
      };
    }

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
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

export interface SessionInfo {
  id: string;
  lastActive: string;
}

/**
 * List sessions in a directory
 */
export async function listSessions(directory: string): Promise<SessionInfo[]> {
  try {
    const result = await execa('claude', ['session', 'list', '--json', '-C', directory], {
      cwd: directory,
      timeout: 10000,
      reject: false,
    });

    if (result.exitCode !== 0) {
      return [];
    }

    const output = result.stdout.trim();
    if (!output) return [];

    const sessions = JSON.parse(output);
    if (Array.isArray(sessions)) {
      return sessions.map((s: { id: string; last_active?: string }) => ({
        id: s.id,
        lastActive: s.last_active || 'unknown',
      }));
    }
    return [];
  } catch {
    return [];
  }
}
