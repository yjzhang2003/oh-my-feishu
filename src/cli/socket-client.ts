/**
 * Socket Client for CLI to Gateway communication
 */

import { createConnection, type Socket } from 'net';
import { log } from '../utils/logger.js';
import type { SessionMessage } from '../gateway/types.js';

const SOCKET_PATH = '/tmp/oh-my-feishu-gateway.sock';

export class GatewaySocketClient {
  private socket: Socket | null = null;
  private messageHandler: ((message: SessionMessage) => void) | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connected = false;

  async connect(onMessage: (message: SessionMessage) => void): Promise<void> {
    this.messageHandler = onMessage;

    return new Promise((resolve, reject) => {
      this.socket = createConnection(SOCKET_PATH, () => {
        log.info('socket-client', 'Connected to Gateway');
        this.connected = true;
        resolve();
      });

      this.socket.on('data', (data) => {
        try {
          const message: SessionMessage = JSON.parse(data.toString());
          if (this.messageHandler) {
            this.messageHandler(message);
          }
        } catch (err) {
          log.error('socket-client', 'Failed to parse message', { error: String(err) });
        }
      });

      this.socket.on('close', () => {
        log.info('socket-client', 'Disconnected from Gateway');
        this.connected = false;
        this.scheduleReconnect();
      });

      this.socket.on('error', (err) => {
        log.error('socket-client', 'Socket error', { error: String(err) });
        if (!this.connected) {
          reject(err);
        }
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      if (this.messageHandler && !this.connected) {
        try {
          await this.connect(this.messageHandler);
        } catch {
          // Will schedule reconnect again
        }
      }
    }, 5000);
  }

  send(message: SessionMessage): void {
    if (!this.socket || !this.connected) {
      log.warn('socket-client', 'Not connected to Gateway');
      return;
    }

    try {
      this.socket.write(JSON.stringify(message) + '\n');
    } catch (err) {
      log.error('socket-client', 'Failed to send message', { error: String(err) });
    }
  }

  createSession(chatId: string, directory: string, senderOpenId: string): void {
    this.send({
      type: 'create',
      chatId,
      directory,
      senderOpenId,
    });
  }

  destroySession(chatId: string): void {
    this.send({
      type: 'destroy',
      chatId,
    });
  }

  sendMessage(chatId: string, content: string, senderOpenId: string, messageId: string): void {
    this.send({
      type: 'message',
      chatId,
      content,
      senderOpenId,
      messageId,
    });
  }

  listSessions(): void {
    this.send({ type: 'list' });
  }

  listGatewayFeatures(): void {
    this.send({ type: 'gateway:list' });
  }

  triggerGatewayFeature(input: {
    feature: string;
    eventType: string;
    payload?: unknown;
  }): void {
    this.send({
      type: 'gateway:trigger',
      feature: input.feature,
      eventType: input.eventType,
      source: 'cli',
      payload: input.payload ?? {},
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}
