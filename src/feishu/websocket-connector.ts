import * as lark from '@larksuiteoapi/node-sdk';
import { log } from '../utils/logger.js';
import { MessageRouter, type MessageData, type SendMessageFn } from './message-router.js';
import { CardDispatcher, type CardActionPayload } from './interactions/card-dispatcher.js';
import { SessionStore } from './interactions/session-store.js';
import { CommandRegistry } from './commands/command-registry.js';
import { RepairCommand } from './commands/repair-command.js';
import { StatusCommand } from './commands/status-command.js';
import { ServiceCommand } from './commands/service-command.js';
import { HelpCommand } from './commands/help-command.js';
import { createNavigationCard } from './card-builder.js';
import { listServices } from '../service/registry.js';

// SDK 事件类型是扁平的，直接在 data 里
export interface P2PChatEnteredData {
  chat_id?: string;
  operator_id?: {
    open_id?: string;
  };
}

export interface FeishuWebSocketConfig {
  appId: string;
  appSecret: string;
  domain?: lark.Domain;
}

const MAX_DEDUP_SET_SIZE = 1000;
const DEDUP_RETAIN_COUNT = 500;

export class FeishuWebSocket {
  private client: lark.Client;
  private wsClient: lark.WSClient | null = null;
  private config: FeishuWebSocketConfig;
  private connected = false;
  private processedMessageIds = new Set<string>();

  // Dependencies
  private sessionStore: SessionStore;
  private commandRegistry: CommandRegistry;
  private messageRouter: MessageRouter;
  private cardDispatcher: CardDispatcher;

  constructor(config: FeishuWebSocketConfig) {
    this.config = config;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain || lark.Domain.Feishu,
    });

    // Initialize dependencies
    this.sessionStore = new SessionStore();
    this.commandRegistry = new CommandRegistry();

    // Register commands
    this.commandRegistry.register(new RepairCommand());
    this.commandRegistry.register(new StatusCommand());
    this.commandRegistry.register(new ServiceCommand());
    this.commandRegistry.register(new HelpCommand());

    // Create sendMessage interface for MessageRouter
    const sendMessage: SendMessageFn = {
      sendTextMessage: (chatId: string, text: string) => this.sendTextMessage(chatId, text),
      sendCardMessage: (chatId: string, card: object) => this.sendCardMessageRaw(chatId, card),
      sendAckReaction: (messageId: string) => this.sendAckReaction(messageId),
      sendCompletionReaction: (messageId: string) => this.sendCompletionReaction(messageId),
      isConnected: () => this.connected,
    };

    this.messageRouter = new MessageRouter(this.commandRegistry, this.sessionStore, sendMessage);

    // CardDispatcher needs sendMessage to send cards
    const sendCard = (chatId: string, card: object) => this.sendCardMessageRaw(chatId, card);
    this.cardDispatcher = new CardDispatcher(this.sessionStore, sendCard);
  }

  async connect(): Promise<void> {
    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: MessageData) => {
        await this.handleMessage(data);
      },
      'card.action.trigger': async (data: CardActionPayload) => {
        await this.handleCardAction(data);
      },
      'im.chat.access_event.bot_p2p_chat_entered_v1': async (data: P2PChatEnteredData) => {
        await this.handleP2PChatEntered(data);
      },
    });

    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      domain: this.config.domain || lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
    });

    await this.wsClient.start({
      eventDispatcher,
    });

    this.connected = true;
    log.info('feishu', 'WebSocket connected');
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
      this.connected = false;
      this.sessionStore.destroy();
      log.info('feishu', 'WebSocket disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): lark.Client {
    return this.client;
  }

  private async handleMessage(data: MessageData): Promise<void> {
    try {
      const { message } = data;

      // Dedup: skip already-processed messages
      if (this.processedMessageIds.has(message.message_id)) {
        log.debug('feishu', 'Duplicate message, skipping', { messageId: message.message_id });
        return;
      }
      this.processedMessageIds.add(message.message_id);
      if (this.processedMessageIds.size > MAX_DEDUP_SET_SIZE) {
        const entries = [...this.processedMessageIds];
        this.processedMessageIds = new Set(entries.slice(-DEDUP_RETAIN_COUNT));
      }

      await this.messageRouter.handleMessage(data);
    } catch (error) {
      log.error('feishu', 'Error handling message', { error: String(error) });
    }
  }

  private async handleCardAction(data: CardActionPayload): Promise<void> {
    try {
      await this.cardDispatcher.dispatch(data);
    } catch (error) {
      log.error('feishu', 'Error handling card action', { error: String(error) });
    }
  }

  private async handleP2PChatEntered(data: P2PChatEnteredData): Promise<void> {
    try {
      const { chat_id: chatId } = data;

      if (!chatId) {
        log.warn('feishu', 'P2P chat entered event without chat_id');
        return;
      }

      // Check if already received nav card for this chat
      const session = this.sessionStore.get(chatId);
      if (session.hasReceivedNav) {
        return;
      }

      // Send navigation card
      const services = listServices();
      const card = createNavigationCard({ showServiceCount: services.length });
      await this.sendCardMessageRaw(chatId, card);
      this.sessionStore.set(chatId, { hasReceivedNav: true });

      log.info('feishu', 'Sent navigation card on P2P chat enter', { chatId });
    } catch (error) {
      log.error('feishu', 'Error handling P2P chat entered', { error: String(error) });
    }
  }

  /**
   * Send ACK emoji reaction to indicate message received
   */
  private async sendAckReaction(messageId: string): Promise<void> {
    try {
      const response = await this.client.im.v1.messageReaction.create({
        data: {
          reaction_type: {
            emoji_type: 'Get',
          },
        },
        path: {
          message_id: messageId,
        },
      });

      if (response.code !== 0) {
        log.debug('feishu', 'ACK reaction response', { code: response.code, msg: response.msg });
      }
    } catch (error) {
      log.debug('feishu', 'Failed to send ACK reaction', { error: String(error) });
    }
  }

  /**
   * Send completion OK reaction to indicate processing finished
   */
  private async sendCompletionReaction(messageId: string): Promise<void> {
    try {
      await this.client.im.v1.messageReaction.create({
        data: {
          reaction_type: {
            emoji_type: 'OK',
          },
        },
        path: {
          message_id: messageId,
        },
      });
    } catch (error) {
      log.debug('feishu', 'Failed to send completion reaction', { error: String(error) });
    }
  }

  async sendTextMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text }),
          msg_type: 'text',
        },
      });
      log.messageOut(chatId, text, 'text');
    } catch (error) {
      log.error('feishu', 'Error sending text message', { chatId, error: String(error) });
    }
  }

  async sendMarkdownMessage(chatId: string, text: string): Promise<void> {
    try {
      const content = JSON.stringify({
        zh_cn: {
          title: '',
          content: [[{ tag: 'text', text }]],
        },
      });

      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content,
          msg_type: 'post',
        },
      });
      log.messageOut(chatId, text.slice(0, 50), 'post');
    } catch (error) {
      log.error('feishu', 'Error sending post message', { chatId, error: String(error) });
      await this.sendTextMessage(chatId, text);
    }
  }

  /**
   * Send card message with simple {title, elements} format
   */
  async sendCardMessage(chatId: string, card: { title: string; elements: string[] }): Promise<void> {
    try {
      const content = lark.messageCard.defaultCard({
        title: card.title,
        content: card.elements.join('\n\n'),
      });

      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content,
          msg_type: 'interactive',
        },
      });
      log.messageOut(chatId, `[Card] ${card.title}`, 'interactive');
    } catch (error) {
      log.error('feishu', 'Error sending card message', { chatId, error: String(error) });
    }
  }

  /**
   * Send raw card object (for interactive cards with buttons)
   */
  private async sendCardMessageRaw(chatId: string, card: object): Promise<void> {
    try {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify(card),
          msg_type: 'interactive',
        },
      });
      log.messageOut(chatId, '[Interactive Card]', 'interactive');
    } catch (error) {
      log.error('feishu', 'Error sending raw card message', { chatId, error: String(error) });
    }
  }
}

/**
 * Load lark-cli configuration
 * Priority: Environment variables > lark-cli config file
 */
export async function loadLarkCliConfig(): Promise<FeishuWebSocketConfig | null> {
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');

  // First check environment variables
  const envAppId = process.env.LARK_APP_ID;
  const envAppSecret = process.env.LARK_APP_SECRET;

  if (envAppId && envAppSecret) {
    log.debug('feishu', 'Using LARK_APP_ID/LARK_APP_SECRET from environment');
    return {
      appId: envAppId,
      appSecret: envAppSecret,
    };
  }

  // Fall back to lark-cli config
  const configPath = path.join(os.homedir(), '.lark-cli', 'config.json');

  if (!fs.existsSync(configPath)) {
    log.error('feishu', 'lark-cli config not found', { path: configPath });
    log.error('feishu', 'Set LARK_APP_ID and LARK_APP_SECRET environment variables or run: lark-cli config init --new');
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    // Handle new config format with apps array
    const appConfig = config.apps?.[0] || config;

    if (!appConfig.appId) {
      log.error('feishu', 'Invalid lark-cli config: missing appId');
      return null;
    }

    // Check if appSecret is stored in keychain (object with source: "keychain")
    if (appConfig.appSecret && typeof appConfig.appSecret === 'object' && appConfig.appSecret.source === 'keychain') {
      log.error('feishu', 'lark-cli stores appSecret in system keychain');
      log.error('feishu', 'Please set LARK_APP_SECRET environment variable in .env file:');
      log.error('feishu', `  LARK_APP_ID=${appConfig.appId}`);
      log.error('feishu', '  LARK_APP_SECRET=your_app_secret');
      return null;
    }

    if (!appConfig.appSecret || typeof appConfig.appSecret !== 'string') {
      log.error('feishu', 'Invalid lark-cli config: missing appSecret');
      return null;
    }

    log.debug('feishu', 'Loaded lark-cli config', { appId: appConfig.appId.slice(0, 8) + '...' });
    return {
      appId: appConfig.appId,
      appSecret: appConfig.appSecret,
      domain: appConfig.brand === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
    };
  } catch (error) {
    log.error('feishu', 'Failed to parse lark-cli config', { error: String(error) });
    return null;
  }
}
