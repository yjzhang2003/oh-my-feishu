/**
 * Message router - unified routing for text messages
 * Routes to: command handlers, chat (Claude), or interaction flows
 */

import { CommandRegistry } from './commands/command-registry.js';
import type { CommandHandler, CommandContext } from './commands/types.js';
import { SessionStore } from './interactions/session-store.js';
import { invokeClaudeChat, type InvokeResult } from '../trigger/invoker.js';
import { log } from '../utils/logger.js';
import type { SessionManager } from '../gateway/session-manager.js';
import type { CardKitManager } from './card-kit.js';

export interface MessageData {
  sender: { sender_id?: { open_id?: string }; sender_type: string };
  message: { message_id: string; chat_id: string; content: string; chat_type: string; message_type?: string };
}

export interface SendMessageFn {
  sendTextMessage(chatId: string, text: string): Promise<void>;
  sendCardMessage(chatId: string, card: object): Promise<void>;
  sendMenuCard(chatId: string): Promise<void>;
  sendAckReaction(messageId: string): Promise<void>;
  sendCompletionReaction(messageId: string): Promise<void>;
  sendCardById?(chatId: string, cardId: string): Promise<void>;
  isConnected(): boolean;
}

export class MessageRouter {
  private inFlightChats = new Map<string, Promise<void>>();
  private sessionManager: SessionManager | null = null;

  constructor(
    private commandRegistry: CommandRegistry,
    private sessionStore: SessionStore,
    private sendMessage: SendMessageFn,
    private cardKitManager?: CardKitManager
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

    // Check for active interaction flow first — flow input (e.g. directory path) may start with /
    const session = this.sessionStore.get(chatId);
    if (session.flow !== 'none') {
      await this.handleFlowInput(chatId, text, senderOpenId, session.flow);
      return;
    }

    // Check if it's a command — commands handle their own responses
    const commandMatch = text.match(/^(\/\S+)(?:\s+(.*))?$/s);
    if (commandMatch) {
      const command = commandMatch[1];
      const args = commandMatch[2]?.trim().split(/\s+/) || [];
      await this.handleCommand(command, args, chatId, chatType, senderOpenId, messageId);
      return;
    }

    // Check if user has received navigation card (send if first time)
    if (!session.hasReceivedNav) {
      await this.sendMessage.sendMenuCard(chatId);
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
      sendMenuCard: () => this.sendMessage.sendMenuCard(chatId),
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

    const session = this.sessionStore.get(chatId);
    const directory = session.mode === 'directory' ? (session.data.directory as string | undefined) : undefined;
    const sessionId = session.mode === 'directory' ? (session.data.sessionId as string | undefined) : undefined;

    if (session.mode === 'directory') {
      log.info('chat', 'Routing to directory session', { chatId, directory });
    }

    await this.runStreamingChat(chatId, chatType, text, senderOpenId, messageId, directory, sessionId);
  }

  private async runStreamingChat(
    chatId: string,
    chatType: string,
    text: string,
    senderOpenId: string,
    messageId: string,
    directory?: string,
    sessionId?: string
  ): Promise<void> {
    let cardId: string | null = null;
    let sequence = 1;
    let cardJson: Record<string, unknown> | null = null;

    // Build card subtitle from mode / directory
    const subtitleText = directory
      ? `${directory}`
      : '直接对话';

    // Create streaming card with only reply_md initially
    // Collapsible panels are inserted dynamically as thinking blocks arrive
    if (this.cardKitManager) {
      try {
        cardJson = {
          schema: '2.0',
          header: {
            title: { content: 'Claude Code', tag: 'plain_text' },
            subtitle: { content: subtitleText, tag: 'plain_text' },
            template: 'wathet',
          },
          config: {
            streaming_mode: true,
            update_multi: true,
            summary: { content: '[生成中...]' },
          },
          body: {
            elements: [
              { tag: 'markdown', content: '', element_id: 'reply_md' },
            ],
          },
        };
        cardId = await this.cardKitManager.createCard(cardJson);
        if (cardId && this.sendMessage.sendCardById) {
          await this.sendMessage.sendCardById(chatId, cardId);
        }
      } catch (err) {
        log.error('chat', 'Failed to create streaming card', { error: String(err) });
        cardId = null;
      }
    }

    // State for dynamic panel management
    let lastPanelId = 'reply_md'; // last element for insert_after
    let currentThinkingPanelId: string | null = null; // panel receiving thinking deltas
    let currentThinkingMdId: string | null = null;     // thinking_md inside current panel
    let toolEventCount = 0;

    // Pending content for debounced flushes
    let pendingText = '';
    let pendingThinking = '';
    let debounceTimer: NodeJS.Timeout | null = null;
    let debounceThinkingTimer: NodeJS.Timeout | null = null;
    let lastFlushTextLength = 0;
    let lastFlushThinkingLength = 0;

    // Create a new collapsible_panel and insert it after lastPanelId
    const insertThinkingPanel = async (): Promise<{ panelId: string; mdId: string }> => {
      if (!cardId || !this.cardKitManager) return { panelId: '', mdId: '' };
      const panelId = `tp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const mdId = `tm_${panelId}`;
      toolEventCount = 0;
      const panel = {
        tag: 'collapsible_panel',
        expanded: true,
        element_id: panelId,
        header: {
          title: { tag: 'markdown', content: '**详情**' },
          icon: { tag: 'standard_icon', token: 'down-small-ccm_outlined', size: '16px 16px' },
          icon_position: 'right',
          icon_expanded_angle: -180,
        },
        elements: [
          { tag: 'markdown', content: '', element_id: mdId },
        ],
      };
      await this.cardKitManager.addCardElements(cardId, [panel], 'insert_after', lastPanelId, sequence++);
      lastPanelId = panelId;
      currentThinkingPanelId = panelId;
      currentThinkingMdId = mdId;
      return { panelId, mdId };
    };

    // Flush pending text and thinking content to respective elements
    const flushUpdate = async () => {
      if (cardId && pendingText) {
        await this.cardKitManager?.updateCardContent(cardId, 'reply_md', pendingText, sequence++);
        lastFlushTextLength = pendingText.length;
        pendingText = '';
      }
      if (cardId && pendingThinking && currentThinkingMdId) {
        await this.cardKitManager?.updateCardContent(cardId, currentThinkingMdId, pendingThinking, sequence++);
        lastFlushThinkingLength = pendingThinking.length;
        pendingThinking = '';
      }
    };

    const scheduleTextUpdate = (content: string) => {
      pendingText = content;
      if (!debounceTimer && cardId) {
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          flushUpdate();
        }, 150);
      }
      if (pendingText.length - lastFlushTextLength > 80) {
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
        flushUpdate();
      }
    };

    const scheduleThinkingUpdate = (content: string) => {
      pendingThinking = content;
      if (!debounceThinkingTimer && cardId) {
        debounceThinkingTimer = setTimeout(() => {
          debounceThinkingTimer = null;
          flushUpdate();
        }, 200);
      }
      if (pendingThinking.length - lastFlushThinkingLength > 100) {
        if (debounceThinkingTimer) { clearTimeout(debounceThinkingTimer); debounceThinkingTimer = null; }
        flushUpdate();
      }
    };

    let accumulatedText = '';

    const invokePromise = invokeClaudeChat(
      {
        message: text,
        chatId,
        chatType,
        senderOpenId,
        messageId,
        directory,
        sessionId,
      },
      300000,
      {
        onThinkingStart: async () => {
          // When a new thinking block starts, insert a new collapsible panel
          await insertThinkingPanel();
        },
        onTextStart: () => {
          // When text block starts, stop routing to thinking panel
          currentThinkingPanelId = null;
          currentThinkingMdId = null;
        },
        onTextDelta: (deltaText) => {
          accumulatedText += deltaText;
          scheduleTextUpdate(accumulatedText);
        },
        onThinkingDelta: async (deltaText) => {
          if (!currentThinkingMdId) {
            // First thinking delta with no panel yet — insert one
            await insertThinkingPanel();
          }
          // Append thinking content to pending (accumulate locally)
          pendingThinking += deltaText;
          scheduleThinkingUpdate(pendingThinking);
        },
        onToolUse: (toolName, input) => {
          toolEventCount++;
          // Tool events don't create new panels — they go into the current thinking panel
          // The thinkingContent is already accumulated, just update the panel
        },
        onDone: async () => {
          if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
          if (debounceThinkingTimer) { clearTimeout(debounceThinkingTimer); debounceThinkingTimer = null; }
          await flushUpdate();
        },
      }
    )
      .then(async (result: InvokeResult) => {
        log.claudeLog(chatId, result.stdout);
        if (!cardId) {
          await this.parseAndSendResponse(result, chatId);
          return;
        }

        // Close streaming mode and update summary
        const finalCardJson = {
          ...cardJson,
          config: {
            ...(cardJson?.config as Record<string, unknown>),
            streaming_mode: false,
            summary: { content: 'Claude Code' },
          },
        };
        await this.cardKitManager?.updateCardFull(cardId, finalCardJson as object, sequence++);
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
    log.info('flow', 'Flow input received', { chatId, flow, text });

    if (flow === 'session-add-step1') {
      // Handle directory session creation
      await this.handleSessionAddInput(chatId, text, senderOpenId);
      return;
    }

    // Other flows handled elsewhere
  }

  private async handleSessionAddInput(chatId: string, directory: string, senderOpenId: string): Promise<void> {
    const trimmedDir = directory.trim();

    if (!trimmedDir) {
      await this.sendMessage.sendTextMessage(chatId, '❌ 目录路径不能为空');
      return;
    }

    if (!trimmedDir.startsWith('/') && !trimmedDir.startsWith('./') && !trimmedDir.startsWith('../')) {
      await this.sendMessage.sendTextMessage(chatId, '❌ 请输入有效路径（绝对路径或相对路径）');
      return;
    }

    const { existsSync, statSync } = await import('fs');
    if (!existsSync(trimmedDir) || !statSync(trimmedDir).isDirectory()) {
      await this.sendMessage.sendTextMessage(chatId, `❌ 目录不存在: ${trimmedDir}\n请输入一个有效的目录路径`);
      return;
    }

    // Set session mode to directory and store the directory
    this.sessionStore.set(chatId, {
      flow: 'none',
      mode: 'directory',
      data: { directory: trimmedDir },
    });

    // Send success message
    await this.sendMessage.sendTextMessage(chatId, `✅ 目录会话已创建\n\n📁 目录: ${trimmedDir}\n\nClaude 进程将在该目录中启动。\n\n💡 发送消息开始对话`);

    log.info('flow', 'Directory session created from Feishu', { chatId, directory: trimmedDir });
  }

  private async parseAndSendResponse(result: InvokeResult, chatId: string): Promise<void> {
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
      return;
    }

    const lines = result.stdout.trim().split('\n');
    let replyText = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        // 过滤系统事件（hooks、notifications 等），这些不展示给用户
        if (parsed.type === 'system') continue;
        // 兼容 --verbose 模式的 stream_event 包装和普通模式
        const actualEvent = parsed.type === 'stream_event' ? parsed.event : parsed;
        if (actualEvent?.type === 'content_block_delta' && actualEvent.delta?.type === 'text_delta') {
          replyText += actualEvent.delta.text;
        }
      } catch {
        // Not JSON — ignore (could be lark-cli output or other logs)
      }
    }

    const trimmedReply = replyText.trim();
    if (trimmedReply) {
      await this.sendMessage.sendTextMessage(chatId, trimmedReply);
    }
  }
}
