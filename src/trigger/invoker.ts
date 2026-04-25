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
  // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 15)}-${(parseInt(hash.slice(15, 16), 16) & 0x3 | 0x8).toString(16)}${hash.slice(16, 18)}-${hash.slice(18, 30)}`;
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
 * Uses session persistence so Claude remembers conversation history
 */
export async function invokeClaudeChat(context: ChatContext, timeout: number = 300000): Promise<InvokeResult> {
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  // Generate session ID for this chat
  const sessionId = chatIdToSessionUuid(context.chatId);

  // Create a session prompt file with context
  const sessionsDir = resolve(workspaceDir, '.claude', 'sessions');
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }

  // Write a context file for this session
  const contextFile = resolve(sessionsDir, `${context.chatId}.md`);
  const contextContent = `# Feishu Chat Context

- **Chat ID**: ${context.chatId}
- **Chat Type**: ${context.chatType}
- **Sender Open ID**: ${context.senderOpenId}

## Available Commands

You have full access to lark-cli to interact with Feishu:

### Messaging
- \`lark-cli im send-text --chat-id ${context.chatId} "<message>"\` - Send text
- \`lark-cli im send-card --chat-id ${context.chatId} '<card_json>'\` - Send card

### User Info
- \`lark-cli contact user get --open-id <open_id>\` - Get user info

## Instructions

1. Respond to the user's message
2. Use lark-cli to send your response back
3. Be helpful and concise
`;

  writeFileSync(contextFile, contextContent);

  try {
    const workspaceEnv = loadWorkspaceEnv();
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      '--session-id', sessionId,
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
