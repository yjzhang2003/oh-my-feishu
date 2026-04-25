import type { Context } from 'hono';
import { createHmac } from 'crypto';
import { env } from '../../config/env.js';
import { sendTextMessage, sendCardMessage } from '../../feishu/client.js';
import { createCard, createMarkdownElement } from '../../feishu/card.js';
import { writeTrigger } from '../../trigger/trigger.js';
import { invokeClaudeSkill } from '../../trigger/invoker.js';

interface FeishuWebhookBody {
  type: string;
  event?: {
    type: string;
    message?: {
      message_id: string;
      root_id: string;
      parent_id: string;
      chat_id: string;
      content: string;
      msg_type: string;
    };
    sender?: {
      sender_id: {
        open_id: string;
        user_id: string;
        union_id: string;
      };
    };
  };
  challenge?: string;
}

/**
 * Verify Feishu signature
 */
function verifySignature(timestamp: string, nonce: string, body: string, signature: string): boolean {
  const encryptKey = env.FEISHU_ENCRYPT_KEY;
  if (!encryptKey) {
    // No encryption key configured, skip verification
    return true;
  }

  const token = env.FEISHU_VERIFICATION_TOKEN || '';
  const content = timestamp + nonce + token + body;
  const hash = createHmac('sha256', encryptKey).update(content).digest('hex');

  return hash === signature;
}

/**
 * Handle Feishu webhook events
 */
export async function handleWebhook(c: Context) {
  // Verify signature if encryption key is configured
  const timestamp = c.req.header('X-Lark-Request-Timestamp') || '';
  const nonce = c.req.header('X-Lark-Request-Nonce') || '';
  const signature = c.req.header('X-Lark-Signature') || '';
  const rawBody = await c.req.text();

  if (!verifySignature(timestamp, nonce, rawBody, signature)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const body = JSON.parse(rawBody) as FeishuWebhookBody;

  // Handle URL verification challenge
  if (body.type === 'url_verification' && body.challenge) {
    return c.json({ challenge: body.challenge });
  }

  // Handle message events
  if (body.type === 'event_callback' && body.event?.type === 'message') {
    const message = body.event.message;
    const sender = body.event.sender;

    if (!message || !sender) {
      return c.json({ error: 'Invalid message event' }, 400);
    }

    try {
      // Parse message content
      const content = JSON.parse(message.content);
      const text = content.text || '';

      // Handle commands
      if (text.startsWith('/repair') || text.startsWith('/fix')) {
        return await handleRepairCommand(c, message.chat_id, text, sender.sender_id.open_id);
      }

      if (text.startsWith('/status')) {
        return await handleStatusCommand(c, message.chat_id);
      }

      if (text.startsWith('/help')) {
        return await handleHelpCommand(c, message.chat_id);
      }

      // Unknown command
      await sendTextMessage(message.chat_id, 'Unknown command. Use /help for available commands.');
      return c.json({ status: 'ok' });

    } catch (error) {
      console.error('Failed to process message:', error);
      return c.json({ error: 'Internal error' }, 500);
    }
  }

  return c.json({ status: 'ignored' });
}

async function handleRepairCommand(c: Context, chatId: string, text: string, senderOpenId: string) {
  // Extract context from command
  const context = text.replace(/^\/(repair|fix)\s*/, '').trim() || 'Repair requested';

  // Send acknowledgment
  await sendCardMessage(chatId, createCard({
    title: '🔄 Auto Repair Started',
    elements: [
      createMarkdownElement(`**Context:** ${context}`),
      createMarkdownElement('Analyzing the issue...'),
    ],
  }));

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
        await sendCardMessage(chatId, createCard({
          title: '✅ Repair Complete',
          elements: [
            createMarkdownElement('The repair has been completed successfully.'),
          ],
        }));
      } else {
        await sendCardMessage(chatId, createCard({
          title: '❌ Repair Failed',
          elements: [
            createMarkdownElement(`\`\`\`\n${result.stderr || 'Unknown error'}\n\`\`\``),
          ],
        }));
      }
    })
    .catch(console.error);

  return c.json({ status: 'accepted' });
}

async function handleStatusCommand(c: Context, chatId: string) {
  const { checkClaudeCli } = await import('../../trigger/invoker.js');
  const claudeStatus = await checkClaudeCli();

  await sendCardMessage(chatId, createCard({
    title: '📊 System Status',
    elements: [
      createMarkdownElement(`**Claude CLI:** ${claudeStatus.available ? `✅ ${claudeStatus.version}` : '❌ Not available'}`),
      createMarkdownElement(`**Feishu Bot:** ${env.FEISHU_APP_ID ? '✅ Configured' : '❌ Not configured'}`),
      createMarkdownElement(`**GitHub:** ${env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured'}`),
    ],
  }));

  return c.json({ status: 'ok' });
}

async function handleHelpCommand(c: Context, chatId: string) {
  await sendTextMessage(chatId, `🤖 Feishu Agent Commands:

/repair [context] - Start auto-repair with optional context
/status - Check system status
/help - Show this help message

Example:
/repair login page returns 500 error`);

  return c.json({ status: 'ok' });
}
