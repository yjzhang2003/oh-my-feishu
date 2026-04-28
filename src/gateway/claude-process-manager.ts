/**
 * Claude Process Manager
 * Manages Claude Code subprocesses for directory sessions
 */

import { execa, type ExecaChildProcess } from 'execa';
import { resolve } from 'path';
import { chatIdToSessionId } from '../utils/chat-id.js';
import { log } from '../utils/logger.js';

export interface ClaudeProcessOptions {
  directory: string;
  chatId: string;
  senderOpenId: string;
  onMessage: (message: string) => void;
  onExit: (code: number) => void;
}

export class ClaudeProcessManager {
  private processes = new Map<string, ExecaChildProcess<string>>();
  private buffers = new Map<string, string>();

  async start(opts: ClaudeProcessOptions): Promise<void> {
    const sessionId = chatIdToSessionId(opts.chatId);

    if (this.processes.has(opts.chatId)) {
      log.warn('claude-process', 'Process already running for chatId', { chatId: opts.chatId });
      return;
    }

    const workspaceDir = resolve(opts.directory);

    // Build environment with Feishu context
    const contextEnv = {
      FEISHU_CHAT_ID: opts.chatId,
      FEISHU_SENDER_OPEN_ID: opts.senderOpenId,
    };

    log.info('claude-process', 'Starting Claude Code', { chatId: opts.chatId, directory: opts.directory });

    const proc = execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      '--resume', sessionId,
      '你是飞书聊天助手。回复用户前请阅读 lark-chat-guide 技能了解回复规则。',
    ], {
      cwd: workspaceDir,
      timeout: 300000,
      reject: false,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, ...contextEnv },
    });

    this.processes.set(opts.chatId, proc);
    this.buffers.set(opts.chatId, '');

    // Handle stdout
    proc.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      this.buffers.set(opts.chatId, this.buffers.get(opts.chatId) + data);

      // Process complete lines
      const buffer = this.buffers.get(opts.chatId) || '';
      const lines = buffer.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          opts.onMessage(line);
        }
      }
      this.buffers.set(opts.chatId, lines[lines.length - 1]);
    });

    // Handle stderr
    proc.stderr?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      log.debug('claude-process', 'stderr', { chatId: opts.chatId, data });
    });

    proc.on('close', (code) => {
      log.info('claude-process', 'Claude Code exited', { chatId: opts.chatId, code });
      this.processes.delete(opts.chatId);
      this.buffers.delete(opts.chatId);
      opts.onExit(code ?? 0);
    });

    proc.on('error', (err) => {
      log.error('claude-process', 'Process error', { chatId: opts.chatId, error: String(err) });
    });
  }

  sendMessage(chatId: string, message: string): void {
    const proc = this.processes.get(chatId);
    if (!proc) {
      log.warn('claude-process', 'No process for chatId', { chatId });
      return;
    }

    // Send message as stdin
    proc.stdin?.write(message + '\n');
  }

  stop(chatId: string): void {
    const proc = this.processes.get(chatId);
    if (proc) {
      log.info('claude-process', 'Stopping Claude Code', { chatId });
      proc.kill();
      this.processes.delete(chatId);
      this.buffers.delete(chatId);
    }
  }

  stopAll(): void {
    for (const [chatId] of this.processes) {
      this.stop(chatId);
    }
  }

  isRunning(chatId: string): boolean {
    return this.processes.has(chatId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.processes.keys());
  }
}
