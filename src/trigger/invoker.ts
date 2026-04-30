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

export interface ClaudeTaskInput {
  feature: string;
  instruction: string;
  context?: Record<string, unknown>;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void | Promise<void>;
  onThinkingDelta?: (text: string) => void | Promise<void>;
  onThinkingStart?: () => void | Promise<void>;
  onTextStart?: () => void | Promise<void>;
  onToolUse?: (toolName: string, input: string) => void | Promise<void>;
  onDone?: () => void | Promise<void>;
}

function buildFeishuContextEnv(context?: {
  chatId?: string;
  senderOpenId?: string;
  chatType?: string;
  messageId?: string;
}): Record<string, string> {
  if (!context) return {};

  return {
    ...(context.chatId ? { FEISHU_CHAT_ID: context.chatId } : {}),
    ...(context.senderOpenId ? { FEISHU_SENDER_OPEN_ID: context.senderOpenId } : {}),
    ...(context.chatType ? { FEISHU_CHAT_TYPE: context.chatType } : {}),
    ...(context.messageId ? { FEISHU_MESSAGE_ID: context.messageId } : {}),
  };
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
 * Invoke Claude Code for a Gateway feature task.
 *
 * This path is intentionally non-streaming: Gateway automations should publish
 * only a final result instead of exposing intermediate thinking or partial text.
 */
export async function invokeClaudeTask(input: ClaudeTaskInput): Promise<InvokeResult> {
  const cwd = input.cwd ? resolve(input.cwd) : resolve(env.REPO_ROOT, 'workspace');
  const timeout = input.timeout ?? 300000;
  const workspaceEnv = loadWorkspaceEnv();

  const prompt = [
    '你正在处理 oh-my-feishu Gateway 功能任务。',
    '这是后台自动化任务，不是实时对话；不要输出中间过程，只返回最终结论、执行结果和必要的后续操作。',
    `功能模块：${input.feature}`,
    '',
    '任务说明：',
    input.instruction,
    '',
    input.context ? `结构化上下文：\n${JSON.stringify(input.context, null, 2)}` : '',
  ].filter(Boolean).join('\n');

  try {
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      prompt,
    ], {
      cwd,
      timeout,
      reject: false,
      stdin: 'ignore',
      env: { ...process.env, ...workspaceEnv, ...input.env },
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
  const contextEnv = buildFeishuContextEnv(context);

  // Use provided sessionId or generate from chatId
  const sessionId = context.sessionId || chatIdToSessionId(context.chatId);

  const prompt = [
    '你正在通过飞书与用户对话。普通问答直接回答；如果用户请求飞书操作，读取 lark-chat-guide 技能。',
    context.message,
  ].join('\n\n');

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
    let streamWork: Promise<void> = Promise.resolve();
    const enqueueStreamCallback = (work: () => void | Promise<void>) => {
      streamWork = streamWork
        .then(async () => {
          await work();
        })
        .catch((err) => {
          console.error('[invoker] stream callback failed:', err);
        });
    };

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
          if (actualEvent?.type === 'content_block_start') {
            console.log('[invoker] content_block_start:', JSON.stringify(actualEvent.content_block?.type));
            if (actualEvent.content_block?.type === 'thinking') {
              enqueueStreamCallback(() => callbacks?.onThinkingStart?.());
            } else if (actualEvent.content_block?.type === 'text') {
              enqueueStreamCallback(() => callbacks?.onTextStart?.());
            }
          } else if (actualEvent?.type === 'content_block_delta') {
            if (actualEvent.delta?.type === 'text_delta') {
              enqueueStreamCallback(() => callbacks?.onTextDelta?.(actualEvent.delta.text));
            } else if (actualEvent.delta?.type === 'thinking_delta') {
              enqueueStreamCallback(() => callbacks?.onThinkingDelta?.(actualEvent.delta.thinking));
            }
          } else if (actualEvent?.type === 'tool_use') {
            enqueueStreamCallback(() => callbacks?.onToolUse?.(actualEvent.name || 'unknown', JSON.stringify(actualEvent.input || {})));
          }
        } catch {
          // Not JSON or not a stream event
        }
      }
    });

    const result = await proc;
    await streamWork;
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
      let retryStreamWork: Promise<void> = Promise.resolve();
      const enqueueRetryStreamCallback = (work: () => void | Promise<void>) => {
        retryStreamWork = retryStreamWork
          .then(async () => {
            await work();
          })
          .catch((err) => {
            console.error('[invoker] retry stream callback failed:', err);
          });
      };

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
                enqueueRetryStreamCallback(() => callbacks?.onTextDelta?.(actualEvent.delta.text));
              } else if (actualEvent.delta?.type === 'thinking_delta') {
                enqueueRetryStreamCallback(() => callbacks?.onThinkingDelta?.(actualEvent.delta.thinking));
              }
            } else if (actualEvent?.type === 'content_block_start') {
              if (actualEvent.content_block?.type === 'thinking') {
                enqueueRetryStreamCallback(() => callbacks?.onThinkingStart?.());
              } else if (actualEvent.content_block?.type === 'text') {
                enqueueRetryStreamCallback(() => callbacks?.onTextStart?.());
              }
            } else if (actualEvent?.type === 'tool_use') {
              enqueueRetryStreamCallback(() => callbacks?.onToolUse?.(actualEvent.name || 'unknown', JSON.stringify(actualEvent.input || {})));
            }
          } catch {
            // Not JSON or not a stream event
          }
        }
      });

      const retryResult = await retryProc;
      await retryStreamWork;
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
