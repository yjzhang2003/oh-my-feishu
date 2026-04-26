import * as lark from '@larksuiteoapi/node-sdk';
import { writeTrigger } from '../trigger/trigger.js';
import { invokeClaudeSkill, invokeClaudeChat } from '../trigger/invoker.js';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

export interface FeishuWebSocketConfig {
  appId: string;
  appSecret: string;
  domain?: lark.Domain;
}

export class FeishuWebSocket {
  private client: lark.Client;
  private wsClient: lark.WSClient | null = null;
  private config: FeishuWebSocketConfig;
  private connected = false;

  constructor(config: FeishuWebSocketConfig) {
    this.config = config;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain || lark.Domain.Feishu,
    });
  }

  async connect(): Promise<void> {
    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data) => {
        await this.handleMessage(data);
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
      log.info('feishu', 'WebSocket disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): lark.Client {
    return this.client;
  }

  private async handleMessage(data: {
    sender: { sender_id?: { open_id?: string }; sender_type: string };
    message: { message_id: string; chat_id: string; content: string; chat_type: string; message_type?: string };
  }): Promise<void> {
    try {
      const { message, sender } = data;

      // Skip bot messages
      if (sender.sender_type === 'bot') {
        return;
      }

      // Parse message content
      let text = '';
      let msgType = message.message_type || 'text';
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
      log.messageIn(chatId, senderOpenId, text, msgType);

      // Send ACK emoji reaction immediately (like Hermes)
      await this.sendAckReaction(messageId);

      // Handle commands
      if (text.startsWith('/repair') || text.startsWith('/fix')) {
        await this.handleRepairCommand(chatId, text, senderOpenId);
        return;
      }

      if (text.startsWith('/status')) {
        log.command(chatId, '/status');
        await this.handleStatusCommand(chatId);
        return;
      }

      if (text.startsWith('/help')) {
        log.command(chatId, '/help');
        await this.handleHelpCommand(chatId);
        return;
      }

      // Regular message - invoke Claude directly
      await this.handleChatMessage(chatId, chatType, text, senderOpenId);
    } catch (error) {
      log.error('feishu', 'Error handling message', { error: String(error) });
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
            emoji_type: 'OK',
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
      // Non-critical - don't block on failure
      log.debug('feishu', 'Failed to send ACK reaction', { error: String(error) });
    }
  }

  private async handleRepairCommand(chatId: string, text: string, senderOpenId: string): Promise<void> {
    const context = text.replace(/^\/(repair|fix)\s*/, '').trim() || 'Repair requested';
    log.command(chatId, '/repair', context);

    // Send acknowledgment
    await this.sendCardMessage(chatId, {
      title: '🔄 Auto Repair Started',
      elements: [
        `**Context:** ${context}`,
        'Analyzing the issue...',
      ],
    });

    // Write trigger
    writeTrigger({
      context,
      source: 'feishu',
      timestamp: new Date().toISOString(),
      metadata: {
        chat_id: chatId,
        sender_open_id: senderOpenId,
      },
    });

    // Invoke skill asynchronously
    log.skill('auto-repair', 'start', { chatId, context });
    invokeClaudeSkill({ skill: 'auto-repair' })
      .then(async (result) => {
        if (result.success) {
          log.skill('auto-repair', 'success', { chatId });
          await this.sendCardMessage(chatId, {
            title: '✅ Repair Complete',
            elements: ['The repair has been completed successfully.'],
          });
        } else {
          log.skill('auto-repair', 'error', { chatId, error: result.stderr });
          await this.sendCardMessage(chatId, {
            title: '❌ Repair Failed',
            elements: [`\`\`\`\n${result.stderr || 'Unknown error'}\n\`\`\``],
          });
        }
      })
      .catch((error) => {
        log.error('feishu', 'Repair command failed', { error: String(error) });
      });
  }

  private async handleStatusCommand(chatId: string): Promise<void> {
    const { checkClaudeCli } = await import('../trigger/invoker.js');
    const claudeStatus = await checkClaudeCli();

    const statusText = `📊 System Status

**Claude CLI:** ${claudeStatus.available ? `✅ ${claudeStatus.version}` : '❌ Not available'}
**WebSocket:** ${this.connected ? '✅ Connected' : '❌ Disconnected'}
**GitHub:** ${env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured'}`;

    await this.sendTextMessage(chatId, statusText);
  }

  private async handleHelpCommand(chatId: string): Promise<void> {
    await this.sendTextMessage(chatId, `🤖 Feishu Agent Commands

/repair [context] - Start auto-repair with optional context
/status - Check system status
/help - Show this help message

Or just send a message to chat with Claude Code!`);
  }

  private async handleChatMessage(chatId: string, chatType: string, text: string, senderOpenId: string): Promise<void> {
    log.info('chat', 'Processing message', { chatId, text: text.slice(0, 50) });

    invokeClaudeChat({
      message: text,
      chatId,
      chatType,
      senderOpenId,
    })
      .then(async (result) => {
        if (result.success && result.stdout.trim()) {
          log.info('chat', 'Claude responded', { chatId });
          await this.sendMarkdownMessage(chatId, result.stdout.trim());
        } else if (result.success) {
          await this.sendTextMessage(chatId, '（Claude 未返回内容）');
        } else {
          log.error('chat', 'Claude failed', { exitCode: result.exitCode, stderr: result.stderr, stdout: result.stdout.slice(0, 200) });
          await this.sendTextMessage(chatId, `❌ Claude 调用失败 (exit ${result.exitCode}): ${(result.stderr || result.stdout).slice(0, 200)}`);
        }
      })
      .catch(async (err) => {
        log.error('chat', 'Chat failed', { error: String(err) });
        await this.sendTextMessage(chatId, `❌ 处理失败: ${String(err).slice(0, 200)}`);
      });
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
      // Feishu bots use "post" msg_type for rich text (markdown-like) content
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
      // Fallback to plain text
      await this.sendTextMessage(chatId, text);
    }
  }

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
