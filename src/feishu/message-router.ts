/**
 * Message router - unified routing for text messages
 * Routes to: command handlers, chat (Claude), or interaction flows
 */

import { CommandRegistry } from './commands/command-registry.js';
import type { CommandHandler, CommandContext } from './commands/types.js';
import { SessionStore } from './interactions/session-store.js';
import { invokeClaudeChat, type InvokeResult } from '../trigger/invoker.js';
import { log } from '../utils/logger.js';
import { createNavigationCard } from './card-builder.js';
import { listServices } from '../service/registry.js';
import type { SessionManager } from '../gateway/session-manager.js';

export interface MessageData {
  sender: { sender_id?: { open_id?: string }; sender_type: string };
  message: { message_id: string; chat_id: string; content: string; chat_type: string; message_type?: string };
}

export interface SendMessageFn {
  sendTextMessage(chatId: string, text: string): Promise<void>;
  sendCardMessage(chatId: string, card: object): Promise<void>;
  sendAckReaction(messageId: string): Promise<void>;
  sendCompletionReaction(messageId: string): Promise<void>;
  isConnected(): boolean;
}

export class MessageRouter {
  private inFlightChats = new Map<string, Promise<void>>();
  private sessionManager: SessionManager | null = null;

  constructor(
    private commandRegistry: CommandRegistry,
    private sessionStore: SessionStore,
    private sendMessage: SendMessageFn
  ) {}

  setSessionManager(manager: SessionManager): void {
    this.sessionManager = manager;
  }

  async handleMessage(data: MessageData): Promise<void> {
    const { message, sender } = data;

    // Skip bot messages
    if (sender.sender_type === 'bot') {
      return;
    }

    // Parse message content
    let text = '';
    try {
      const content = JSON.parse(message.content);
      text = content.text || '';
    } catch {
      text = message.content;
    }

    const chatId = message.chat_id;
    const chatType = message.chat_type;
    const messageId = message.message_id;
    const senderOpenId = sender.sender_id?.open_id || '';

    if (!senderOpenId) {
      log.warn('feishu', 'Message without sender_id, skipping');
      return;
    }

    // Log incoming message
    log.messageIn(chatId, senderOpenId, text, message.message_type || 'text');

    // Send ACK emoji reaction immediately (non-blocking)
    this.sendMessage.sendAckReaction(messageId).catch(() => {});

    // Check if it's a command first - commands handle their own responses
    const commandMatch = text.match(/^(\/\S+)(?:\s+(.*))?$/s);
    if (commandMatch) {
      const command = commandMatch[1];
      const args = commandMatch[2]?.trim().split(/\s+/) || [];
      await this.handleCommand(command, args, chatId, chatType, senderOpenId, messageId);
      return;
    }

    // Check for active interaction flow
    const session = this.sessionStore.get(chatId);
    if (session.flow !== 'none') {
      await this.handleFlowInput(chatId, text, senderOpenId, session.flow);
      return;
    }

    // Check if user has received navigation card (send if first time)
    if (!session.hasReceivedNav) {
      const services = listServices();
      await this.sendMessage.sendCardMessage(chatId, createNavigationCard({ showServiceCount: services.length }));
      this.sessionStore.set(chatId, { hasReceivedNav: true });
    }

    // Regular chat message
    await this.handleChat(chatId, chatType, text, senderOpenId, messageId);
  }

  private async handleCommand(
    command: string,
    args: string[],
    chatId: string,
    chatType: string,
    senderOpenId: string,
    messageId: string
  ): Promise<void> {
    const handler = this.commandRegistry.find(command);
    if (!handler) {
      log.warn('feishu', 'Unknown command', { command });
      return;
    }

    const ctx: CommandContext = {
      chatId,
      senderOpenId,
      chatType,
      messageId,
      args,
      connected: this.sendMessage.isConnected(),
      sendText: (text: string) => this.sendMessage.sendTextMessage(chatId, text),
      sendCard: (card: object) =>
        this.sendMessage.sendCardMessage(chatId, card),
    };

    log.command(chatId, command, args.join(' '));
    await handler.execute(ctx);
  }

  private async handleChat(
    chatId: string,
    chatType: string,
    text: string,
    senderOpenId: string,
    messageId: string
  ): Promise<void> {
    // Per-chat concurrency lock: reject if Claude is already processing for this chat
    if (this.inFlightChats.has(chatId)) {
      log.warn('chat', 'Message rejected — Claude already processing for this chat', { chatId });
      await this.sendMessage.sendTextMessage(chatId, '⏳ 上一条消息还在处理中，请稍等');
      return;
    }

    log.info('chat', 'Processing message', { chatId, text: text.slice(0, 50) });

    // Check session mode from SessionStore
    const session = this.sessionStore.get(chatId);

    // Route based on session mode
    if (session.mode === 'directory') {
      log.info('chat', 'Routing to directory session (mode=directory)', { chatId });
      this.sessionManager?.sendToSession(chatId, text, senderOpenId, messageId);
      return;
    }

    // Direct mode - invoke main Gateway agent
    const invokePromise = invokeClaudeChat({
      message: text,
      chatId,
      chatType,
      senderOpenId,
      messageId,
    })
      .then(async (result: InvokeResult) => {
        log.claudeLog(chatId, result.stdout);

        if (!result.success) {
          log.error('chat', 'Claude failed', {
            exitCode: result.exitCode,
            stderr: result.stderr,
            stdout: result.stdout.slice(0, 200),
          });
          await this.sendMessage.sendTextMessage(
            chatId,
            `❌ Claude 调用失败 (exit ${result.exitCode}): ${(result.stderr || result.stdout).slice(0, 200)}`
          );
        }
      })
      .catch(async (err: unknown) => {
        log.error('chat', 'Chat failed', { error: String(err) });
        await this.sendMessage.sendTextMessage(chatId, `❌ 处理失败: ${String(err).slice(0, 200)}`);
      })
      .finally(() => {
        this.inFlightChats.delete(chatId);
        this.sendMessage.sendCompletionReaction(messageId).catch(() => {});
      });

    this.inFlightChats.set(chatId, invokePromise);
    invokePromise.catch(() => {});
  }

  private async handleFlowInput(
    chatId: string,
    text: string,
    senderOpenId: string,
    flow: string
  ): Promise<void> {
    // This will be connected to flow handlers later
    log.info('flow', 'Flow input received', { chatId, flow, text });
  }
}
