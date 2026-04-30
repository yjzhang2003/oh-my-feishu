import * as lark from '@larksuiteoapi/node-sdk';
import { resolve } from 'path';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import { MessageRouter, type MessageData, type SendMessageFn } from './message-router.js';
import { CardDispatcher, type CardActionPayload, type CardActionResponse } from './interactions/card-dispatcher.js';
import { SessionHistoryStore } from './interactions/session-history-store.js';
import { SessionStore } from './interactions/session-store.js';
import { CommandRegistry } from './commands/command-registry.js';
import { RepairCommand } from './commands/repair-command.js';
import { StatusCommand } from './commands/status-command.js';
import { ServiceCommand } from './commands/service-command.js';
import { HelpCommand } from './commands/help-command.js';
import { MenuCommand } from './commands/menu-command.js';
import { SessionManager } from '../gateway/session-manager.js';
import { CardKitManager } from './card-kit.js';
import { createMainMenuCard } from './card-builder/menu-cards.js';
import { install as installPlugin } from '../marketplace/index.js';

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
  private sessionHistoryStore: SessionHistoryStore;
  private commandRegistry: CommandRegistry;
  private messageRouter: MessageRouter;
  private cardDispatcher: CardDispatcher;
  private sessionManager: SessionManager;
  private cardKitManager: CardKitManager;

  constructor(config: FeishuWebSocketConfig) {
    this.config = config;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain || lark.Domain.Feishu,
    });

    // Initialize dependencies
    this.sessionStore = new SessionStore();
    this.sessionHistoryStore = new SessionHistoryStore(process.cwd());
    this.commandRegistry = new CommandRegistry();

    // Register commands
    this.commandRegistry.register(new RepairCommand());
    this.commandRegistry.register(new StatusCommand());
    this.commandRegistry.register(new ServiceCommand());
    this.commandRegistry.register(new HelpCommand());
    this.commandRegistry.register(new MenuCommand());

    // CardKit manager for in-place card updates
    this.cardKitManager = new CardKitManager(this.client, config.domain);

    // Create sendMessage interface for MessageRouter
    const sendMessage: SendMessageFn = {
      sendTextMessage: (chatId: string, text: string) => this.sendTextMessage(chatId, text),
      sendCardMessage: (chatId: string, card: object) => this.sendCardMessageRaw(chatId, card),
      sendMenuCard: (chatId: string) => this.sendMenuCard(chatId),
      sendAckReaction: (messageId: string) => this.sendAckReaction(messageId),
      sendCompletionReaction: (messageId: string) => this.sendCompletionReaction(messageId),
      sendCardById: (chatId: string, cardId: string) => this.sendCardById(chatId, cardId),
      isConnected: () => this.connected,
    };

    this.messageRouter = new MessageRouter(this.commandRegistry, this.sessionStore, sendMessage, this.cardKitManager);

    // CardDispatcher needs sendCard to send cards and cardKitManager for updates
    const sendCard = (chatId: string, card: object) => this.sendCardMessageRaw(chatId, card);
    this.cardDispatcher = new CardDispatcher(this.sessionStore, this.sessionHistoryStore, this.cardKitManager, sendCard);

    // SessionManager for directory sessions
    this.sessionManager = new SessionManager(this.sessionStore, sendMessage);
    this.messageRouter.setSessionManager(this.sessionManager);
  }

  async connect(): Promise<void> {
    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: MessageData) => {
        await this.handleMessage(data);
      },
      'card.action.trigger': async (data: CardActionPayload) => {
        return await this.handleCardAction(data);
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

    // Start SessionManager IPC server
    await this.sessionManager.start();

    // Install Feishu skills into workspace for direct chat mode.
    const workspaceDir = resolve(env.REPO_ROOT, 'workspace');
    installPlugin({ targetDir: workspaceDir }).catch((err) => {
      log.warn('feishu', 'Failed to install plugin into workspace', { error: String(err) });
    });

    this.connected = true;
    log.info('feishu', 'WebSocket connected');
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
      this.connected = false;
      await this.sessionManager.stop();
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

  /**
   * Create bot menu using application:bot.menu:write permission
   * Bot menu appears when user clicks bot in chat
   */
  async createBotMenu(): Promise<void> {
    try {
      const domain = this.config.domain === lark.Domain.Lark ? 'https://open.larksuite.com' : 'https://open.feishu.com';
      const response = await this.client.httpInstance.post(
        `${domain}/open-apis/application/v6/bots/me/menus`,
        {
          menu_tree: {
            chat_menu_top_levels: [
              {
                chat_menu_item: {
                  action_type: 'NONE',
                  name: '导航',
                  i18n_names: { zh_cn: '导航' },
                },
                children: [
                  {
                    chat_menu_item: {
                      action_type: 'NONE',
                      name: '服务管理',
                      i18n_names: { zh_cn: '服务管理' },
                    },
                  },
                  {
                    chat_menu_item: {
                      action_type: 'NONE',
                      name: '报修',
                      i18n_names: { zh_cn: '报修' },
                    },
                  },
                  {
                    chat_menu_item: {
                      action_type: 'NONE',
                      name: '帮助',
                      i18n_names: { zh_cn: '帮助' },
                    },
                  },
                ],
              },
            ],
          },
        }
      );
      log.info('feishu', 'Bot menu created', { response: JSON.stringify(response) });
    } catch (error) {
      log.error('feishu', 'Failed to create bot menu', { error: String(error) });
    }
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

  private async handleCardAction(data: CardActionPayload): Promise<CardActionResponse | void> {
    try {
      const response = await this.cardDispatcher.dispatch(data);
      log.info('feishu', 'Card action response', {
        hasToast: !!response.toast,
        toastType: response.toast?.type,
        toastContent: response.toast?.content,
        hasCard: !!response.card,
        cardType: response.card?.type,
        cardDataKeys: response.card?.data ? Object.keys(response.card.data) : [],
        fullResponse: JSON.stringify(response).slice(0, 500)
      });
      return response;
    } catch (error) {
      log.error('feishu', 'Error handling card action', { error: String(error) });
      return { toast: { type: 'error', content: '操作失败' } };
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
            emoji_type: 'DONE',
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

  /**
   * Send a card entity by its card_id (for streaming cards)
   */
  private async sendCardById(chatId: string, cardId: string): Promise<void> {
    try {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ type: 'card', data: { card_id: cardId } }),
          msg_type: 'interactive',
        },
      });
      log.messageOut(chatId, `[Card Entity] ${cardId}`, 'interactive');
    } catch (error) {
      log.error('feishu', 'Error sending card by id', { chatId, cardId, error: String(error) });
    }
  }

  /**
   * Send menu card via cardkit: create entity then send by card_id
   */
  private async sendMenuCard(chatId: string): Promise<void> {
    try {
      const { card, elementIds } = createMainMenuCard();
      const cardId = await this.cardKitManager.createCard(card);

      if (!cardId) {
        log.warn('feishu', 'cardkit createCard returned null, falling back to raw menu card', { chatId });
        await this.sendCardMessageRaw(chatId, card);
        return;
      }

      // Send message with card content
      // Note: cardkit creates a card entity, but sending requires the actual card JSON in content
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

      // Save card state for subsequent updates
      this.sessionStore.set(chatId, {
        cardId,
        cardSequence: 1,
        cardElementIds: elementIds,
      });

      log.messageOut(chatId, '[Menu Card via CardKit]', 'interactive');
    } catch (error) {
      const err = error as any;
      log.error('feishu', 'Error sending menu card', {
        chatId,
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        headers: err.response?.headers,
      });
      await this.sendTextMessage(chatId, `⚠️ 菜单加载失败: ${err.message || String(error)}`);
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
