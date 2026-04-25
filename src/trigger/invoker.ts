import { execa } from 'execa';
import { resolve } from 'path';
import { env } from '../config/env.js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

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
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      `/${skill}`,
    ], {
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
 * Uses --continue to maintain conversation context
 */
export async function invokeClaudeChat(context: ChatContext, timeout: number = 300000): Promise<InvokeResult> {
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  // Create prompt with lark-cli capabilities
  const systemPrompt = `You are a Feishu chat assistant with full access to lark-cli.

You MUST respond using lark-cli commands. Choose the appropriate method:
- Text: lark-cli im send-text --chat-id ${context.chatId} "message"
- Card (for rich content/structured data): lark-cli im send-card --chat-id ${context.chatId} '<card_json>'
- Message with markdown: use send-card with appropriate card structure

Use lark-cli --help to discover more capabilities like documents, calendar, contacts, etc.

Context:
- Chat ID: ${context.chatId}
- Chat Type: ${context.chatType}
- Sender Open ID: ${context.senderOpenId}

Always send your response back via lark-cli, not just output text.`;

  try {
    const workspaceEnv = loadWorkspaceEnv();
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      '-c', // Continue previous conversation for context
      '--append-system-prompt', systemPrompt,
      context.message,
    ], {
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
