import { execa } from 'execa';
import { resolve } from 'path';
import { env } from '../config/env.js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { chatIdToSessionId } from '../utils/chat-id.js';
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

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onThinkingDelta?: (text: string) => void;
  onThinkingStart?: () => void;
  onTextStart?: () => void;
  onToolUse?: (toolName: string, input: string) => void;
  onDone?: () => void;
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
export async function invokeClaudeChat(
  context: ChatContext,
  timeout: number = 300000,
  callbacks?: StreamCallbacks
): Promise<InvokeResult> {
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
  const sessionId = context.sessionId || chatIdToSessionId(context.chatId);

  // Use /lark-chat-guide skill invocation to force Claude to load the skill
  const prompt = `/lark-chat-guide ${context.message}`;

  try {
    const workspaceEnv = loadWorkspaceEnv();

    // Build claude arguments
    const claudeArgs: string[] = ['-p', '--dangerously-skip-permissions'];
    claudeArgs.push('--output-format', 'stream-json', '--include-partial-messages', '--verbose');
    claudeArgs.push('--resume', sessionId, prompt);

    const proc = execa('claude', claudeArgs, {
      cwd,
      timeout,
      reject: false,
      stdin: 'ignore',
      stdout: 'pipe',
      env: { ...process.env, ...workspaceEnv, ...contextEnv },
    });

    let fullStdout = '';
    let buffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      fullStdout += data;
      buffer += data;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === 'system') continue;
          const actualEvent = parsed.type === 'stream_event' ? parsed.event : parsed;
          if (actualEvent?.type === 'content_block_delta') {
            if (actualEvent.delta?.type === 'text_delta') {
              callbacks?.onTextDelta?.(actualEvent.delta.text);
            } else if (actualEvent.delta?.type === 'thinking_delta') {
              callbacks?.onThinkingDelta?.(actualEvent.delta.thinking);
            }
          } else if (actualEvent?.type === 'content_block_start') {
            if (actualEvent.content_block?.type === 'thinking') {
              callbacks?.onThinkingStart?.();
            } else if (actualEvent.content_block?.type === 'text') {
              callbacks?.onTextStart?.();
            }
          } else if (actualEvent?.type === 'tool_use') {
            callbacks?.onToolUse?.(actualEvent.name || 'unknown', JSON.stringify(actualEvent.input || {}));
          }
        } catch {
          // Not JSON or not a stream event
        }
      }
    });

    const result = await proc;
    await callbacks?.onDone?.();

    // If session not found, retry without --resume
    if (result.stderr?.includes('No conversation found with session ID')) {
      const retryArgs: string[] = ['-p', '--dangerously-skip-permissions'];
      retryArgs.push('--output-format', 'stream-json', '--include-partial-messages', '--verbose');
      retryArgs.push(prompt);

      const retryProc = execa('claude', retryArgs, {
        cwd,
        timeout,
        reject: false,
        stdin: 'ignore',
        stdout: 'pipe',
        env: { ...process.env, ...workspaceEnv, ...contextEnv },
      });

      let retryStdout = '';
      let retryBuffer = '';

      retryProc.stdout?.on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        retryStdout += data;
        retryBuffer += data;

        const lines = retryBuffer.split('\n');
        retryBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.type === 'system') continue;
            const actualEvent = parsed.type === 'stream_event' ? parsed.event : parsed;
            if (actualEvent?.type === 'content_block_delta') {
              if (actualEvent.delta?.type === 'text_delta') {
                callbacks?.onTextDelta?.(actualEvent.delta.text);
              } else if (actualEvent.delta?.type === 'thinking_delta') {
                callbacks?.onThinkingDelta?.(actualEvent.delta.thinking);
              }
            } else if (actualEvent?.type === 'content_block_start') {
              if (actualEvent.content_block?.type === 'thinking') {
                callbacks?.onThinkingStart?.();
              } else if (actualEvent.content_block?.type === 'text') {
                callbacks?.onTextStart?.();
              }
            } else if (actualEvent?.type === 'tool_use') {
              callbacks?.onToolUse?.(actualEvent.name || 'unknown', JSON.stringify(actualEvent.input || {}));
            }
          } catch {
            // Not JSON or not a stream event
          }
        }
      });

      const retryResult = await retryProc;
      await callbacks?.onDone?.();

      return {
        success: retryResult.exitCode === 0,
        stdout: retryStdout,
        stderr: retryResult.stderr,
        exitCode: retryResult.exitCode ?? 1,
      };
    }

    return {
      success: result.exitCode === 0,
      stdout: fullStdout,
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
