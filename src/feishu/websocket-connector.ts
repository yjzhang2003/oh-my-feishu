import * as lark from '@larksuiteoapi/node-sdk';
import { writeTrigger } from '../trigger/trigger.js';
import { invokeClaudeSkill } from '../trigger/invoker.js';
import { env } from '../config/env.js';

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
    console.log('[Feishu] WebSocket connected');
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
      this.connected = false;
      console.log('[Feishu] WebSocket disconnected');
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
    message: { message_id: string; chat_id: string; content: string; chat_type: string };
  }): Promise<void> {
    try {
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
      const senderOpenId = sender.sender_id?.open_id || '';

      if (!senderOpenId) {
        console.warn('[Feishu] Message without sender_id, skipping');
        return;
      }

      console.log(`[Feishu] Received message from ${senderOpenId}: ${text}`);

      // Handle commands
      if (text.startsWith('/repair') || text.startsWith('/fix')) {
        await this.handleRepairCommand(chatId, text, senderOpenId);
        return;
      }

      if (text.startsWith('/status')) {
        await this.handleStatusCommand(chatId);
        return;
      }

      if (text.startsWith('/help')) {
        await this.handleHelpCommand(chatId);
        return;
      }

      // Regular message - trigger chat skill
      await this.handleChatMessage(chatId, text, senderOpenId);
    } catch (error) {
      console.error('[Feishu] Error handling message:', error);
    }
  }

  private async handleRepairCommand(chatId: string, text: string, senderOpenId: string): Promise<void> {
    const context = text.replace(/^\/(repair|fix)\s*/, '').trim() || 'Repair requested';

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
    invokeClaudeSkill({ skill: 'auto-repair' })
      .then(async (result) => {
        if (result.success) {
          await this.sendCardMessage(chatId, {
            title: '✅ Repair Complete',
            elements: ['The repair has been completed successfully.'],
          });
        } else {
          await this.sendCardMessage(chatId, {
            title: '❌ Repair Failed',
            elements: [`\`\`\`\n${result.stderr || 'Unknown error'}\n\`\`\``],
          });
        }
      })
      .catch(console.error);
  }

  private async handleStatusCommand(chatId: string): Promise<void> {
    const { checkClaudeCli } = await import('../trigger/invoker.js');
    const claudeStatus = await checkClaudeCli();

    await this.sendTextMessage(chatId, `📊 System Status

**Claude CLI:** ${claudeStatus.available ? `✅ ${claudeStatus.version}` : '❌ Not available'}
**WebSocket:** ${this.connected ? '✅ Connected' : '❌ Disconnected'}
**GitHub:** ${env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  }

  private async handleHelpCommand(chatId: string): Promise<void> {
    await this.sendTextMessage(chatId, `🤖 Feishu Agent Commands

/repair [context] - Start auto-repair with optional context
/status - Check system status
/help - Show this help message

Or just send a message to chat with Claude Code!`);
  }

  private async handleChatMessage(chatId: string, text: string, senderOpenId: string): Promise<void> {
    // Send typing indicator
    await this.sendTextMessage(chatId, '🤔 Thinking...');

    // Write trigger for chat skill
    writeTrigger({
      context: text,
      source: 'feishu-chat',
      timestamp: new Date().toISOString(),
      metadata: {
        chat_id: chatId,
        sender_open_id: senderOpenId,
        message: text,
      },
    });

    // Invoke chat skill
    invokeClaudeSkill({ skill: 'chat' })
      .then(async (result) => {
        if (result.success) {
          console.log('[Chat] Skill completed successfully');
        } else {
          await this.sendTextMessage(chatId, `❌ Error: ${result.stderr || 'Unknown error'}`);
        }
      })
      .catch(async (err) => {
        console.error('[Chat] Skill failed:', err);
        await this.sendTextMessage(chatId, '❌ Failed to process your message. Please try again.');
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
    } catch (error) {
      console.error('[Feishu] Error sending text message:', error);
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
    } catch (error) {
      console.error('[Feishu] Error sending card message:', error);
    }
  }
}

/**
 * Load lark-cli configuration
 */
export async function loadLarkCliConfig(): Promise<FeishuWebSocketConfig | null> {
  const { execa } = await import('execa');
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');

  const configPath = path.join(os.homedir(), '.lark-cli', 'config.json');

  if (!fs.existsSync(configPath)) {
    console.error('[Feishu] lark-cli config not found at', configPath);
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    if (!config.appId || !config.appSecret) {
      console.error('[Feishu] Invalid lark-cli config: missing appId or appSecret');
      return null;
    }

    return {
      appId: config.appId,
      appSecret: config.appSecret,
    };
  } catch (error) {
    console.error('[Feishu] Failed to parse lark-cli config:', error);
    return null;
  }
}
