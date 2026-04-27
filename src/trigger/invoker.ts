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
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  // Pass context as environment variables for the skill to use
  const contextEnv = {
    FEISHU_CHAT_ID: context.chatId,
    FEISHU_SENDER_OPEN_ID: context.senderOpenId,
    FEISHU_CHAT_TYPE: context.chatType,
    ...(context.messageId ? { FEISHU_MESSAGE_ID: context.messageId } : {}),
  };

  // Generate a session ID based on chat ID for conversation continuity
  const sessionId = chatIdToSessionUuid(context.chatId);

  // Prepend lark-chat-guide reference so Claude knows to reply via lark-cli
  // lark-chat-guide contains the rule: must use lark-cli to reply, stdout is not shown to user
  const prompt = `回复用户前请阅读 lark-chat-guide 技能了解回复规则。\n\n${context.message}`;

  try {
    const workspaceEnv = loadWorkspaceEnv();
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      '--resume', sessionId,
      prompt,
    ], {
      cwd: workspaceDir,
      timeout,
      reject: false,
      stdin: 'ignore',
      env: { ...process.env, ...workspaceEnv, ...contextEnv },
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
