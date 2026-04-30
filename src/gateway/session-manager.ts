/**
 * Session Manager
 * Manages all Gateway sessions (direct and directory)
 */

import { chatIdToSessionId } from '../utils/chat-id.js';
import { log } from '../utils/logger.js';
import { ClaudeProcessManager } from './claude-process-manager.js';
import { UnixSocketBridge, type MessageHandler } from './ipc/unix-socket-bridge.js';
import type { Session, SessionMessage, SessionInfo } from './types.js';
import type { Socket } from 'net';
import type { SessionStore } from '../feishu/interactions/session-store.js';
import type { SendMessageFn } from '../feishu/message-router.js';
import { createGatewayEvent, type GatewayFeatureRunner } from './features/index.js';

export class SessionManager {
  private sessions = new Map<string, Session>();
  private sessionsSockets = new Map<string, Socket>();
  private processManager: ClaudeProcessManager;
  private socketBridge: UnixSocketBridge;
  private messageHandlers: Map<string, (message: string) => void> = new Map();
  private sessionStore: SessionStore;
  private sendMessage: SendMessageFn;
  private gatewayFeatureRunner?: GatewayFeatureRunner;

  constructor(sessionStore: SessionStore, sendMessage: SendMessageFn, gatewayFeatureRunner?: GatewayFeatureRunner) {
    this.sessionStore = sessionStore;
    this.sendMessage = sendMessage;
    this.gatewayFeatureRunner = gatewayFeatureRunner;
    this.processManager = new ClaudeProcessManager();
    this.socketBridge = new UnixSocketBridge();
  }

  async start(): Promise<void> {
    const handler: MessageHandler = (message, socket) => {
      this.handleIpcMessage(message, socket);
    };
    await this.socketBridge.start(handler);
    log.info('session-manager', 'Session manager started');
  }

  async stop(): Promise<void> {
    this.processManager.stopAll();
    await this.socketBridge.stop();
    this.sessions.clear();
    log.info('session-manager', 'Session manager stopped');
  }

  private handleIpcMessage(message: SessionMessage, socket: Socket): void {
    switch (message.type) {
      case 'create':
        this.handleCreateSession(message, socket);
        break;
      case 'destroy':
        this.handleDestroySession(message);
        break;
      case 'message':
        this.handleChatMessage(message);
        break;
      case 'list':
        this.handleListSessions(socket);
        break;
      case 'gateway:list':
        this.handleGatewayList(socket);
        break;
      case 'gateway:trigger':
        this.handleGatewayTrigger(message, socket);
        break;
    }
  }

  private handleCreateSession(message: SessionMessage, socket: Socket): void {
    if (!message.chatId || !message.directory) {
      log.error('session-manager', 'Missing chatId or directory for create session');
      return;
    }

    const chatId = message.chatId;
    const directory = message.directory;
    const sessionId = chatIdToSessionId(chatId);
    const session: Session = {
      id: sessionId,
      type: 'directory',
      chatId,
      directory,
      createdAt: new Date(),
    };

    this.sessions.set(chatId, session);

    // Store the socket for this session so we can send Feishu messages to it
    this.sessionsSockets.set(chatId, socket);

    // Start Claude Code process for this directory session
    this.processManager.start({
      directory,
      chatId,
      senderOpenId: message.senderOpenId || '',
      onMessage: (msg) => {
        // Forward Claude's output back to the socket (CLI)
        const sessionSocket = this.sessionsSockets.get(chatId);
        if (sessionSocket) {
          this.socketBridge.send(sessionSocket, {
            type: 'message',
            sessionId,
            chatId,
            content: msg,
          });
        }
      },
      onExit: (code) => {
        log.info('session-manager', 'Claude process exited', { chatId, code });
        this.sessions.delete(chatId);
        this.sessionsSockets.delete(chatId);
      },
    });

    log.info('session-manager', 'Directory session created', { chatId, directory });
  }

  private handleDestroySession(message: SessionMessage): void {
    if (!message.chatId) return;

    this.processManager.stop(message.chatId);
    this.sessions.delete(message.chatId);
    this.sessionsSockets.delete(message.chatId);
    log.info('session-manager', 'Session destroyed', { chatId: message.chatId });
  }

  private handleChatMessage(message: SessionMessage): void {
    if (!message.chatId || !message.content) return;

    const session = this.sessions.get(message.chatId);
    if (!session) {
      log.warn('session-manager', 'No session found for chatId', { chatId: message.chatId });
      return;
    }

    if (session.type === 'directory') {
      this.processManager.sendMessage(message.chatId, message.content);
    }
  }

  // Send message from Feishu to CLI (called by MessageRouter)
  sendToSession(chatId: string, content: string, senderOpenId: string, messageId: string): void {
    const socket = this.sessionsSockets.get(chatId);
    if (socket) {
      this.socketBridge.send(socket, {
        type: 'message',
        chatId,
        content,
        senderOpenId,
        messageId,
      });
    }
  }

  private handleListSessions(socket: Socket): void {
    const sessions: SessionInfo[] = Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      type: s.type,
      chatId: s.chatId,
      directory: s.directory,
      createdAt: s.createdAt.toISOString(),
    }));

    this.socketBridge.send(socket, {
      type: 'list',
      content: JSON.stringify(sessions),
    });
  }

  private handleGatewayList(socket: Socket): void {
    if (!this.gatewayFeatureRunner) {
      this.socketBridge.send(socket, {
        type: 'gateway:list',
        content: JSON.stringify({ success: false, error: 'Gateway feature runner is not configured' }),
      });
      return;
    }

    this.socketBridge.send(socket, {
      type: 'gateway:list',
      content: JSON.stringify({
        success: true,
        features: this.gatewayFeatureRunner.listFeatures(),
      }),
    });
  }

  private async handleGatewayTrigger(message: SessionMessage, socket: Socket): Promise<void> {
    if (!this.gatewayFeatureRunner) {
      this.socketBridge.send(socket, {
        type: 'gateway:trigger',
        content: JSON.stringify({ success: false, error: 'Gateway feature runner is not configured' }),
      });
      return;
    }

    if (!message.feature || !message.eventType) {
      this.socketBridge.send(socket, {
        type: 'gateway:trigger',
        content: JSON.stringify({ success: false, error: 'feature and eventType are required' }),
      });
      return;
    }

    const result = await this.gatewayFeatureRunner.run(createGatewayEvent({
      feature: message.feature,
      type: message.eventType,
      source: message.source || 'cli',
      chatId: message.chatId,
      senderOpenId: message.senderOpenId,
      messageId: message.messageId,
      payload: message.payload ?? {},
    }));

    this.socketBridge.send(socket, {
      type: 'gateway:trigger',
      content: JSON.stringify(result),
    });
  }

  // For gateway-direct sessions, we don't need process management
  // Messages go directly to the existing invokeClaudeChat flow
  registerGatewayDirect(chatId: string): Session {
    const sessionId = chatIdToSessionId(chatId);
    const session: Session = {
      id: sessionId,
      type: 'gateway-direct',
      chatId,
      createdAt: new Date(),
    };
    this.sessions.set(chatId, session);
    return session;
  }

  getSession(chatId: string): Session | undefined {
    return this.sessions.get(chatId);
  }

  isDirectorySession(chatId: string): boolean {
    const session = this.sessions.get(chatId);
    return session?.type === 'directory';
  }

  getSocketPath(): string {
    return this.socketBridge.getSocketPath();
  }
}
