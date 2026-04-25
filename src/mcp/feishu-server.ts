/**
 * MCP Server for Feishu messaging
 *
 * Exposes tools for Claude Code CLI to send messages back to Feishu:
 * - send_text: Send a text message
 * - send_card: Send an interactive card
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as lark from '@larksuiteoapi/node-sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Tool definitions
const SEND_TEXT_TOOL = {
  name: 'send_text',
  description: 'Send a text message to a Feishu chat. Use this to respond to the user.',
  inputSchema: {
    type: 'object',
    properties: {
      chat_id: {
        type: 'string',
        description: 'The chat ID to send the message to (from context)',
      },
      text: {
        type: 'string',
        description: 'The text message to send',
      },
    },
    required: ['chat_id', 'text'],
  },
};

const SEND_CARD_TOOL = {
  name: 'send_card',
  description: 'Send an interactive card message to a Feishu chat. Use for rich content like formatted text, lists, or interactive elements.',
  inputSchema: {
    type: 'object',
    properties: {
      chat_id: {
        type: 'string',
        description: 'The chat ID to send the message to (from context)',
      },
      title: {
        type: 'string',
        description: 'Card title',
      },
      content: {
        type: 'string',
        description: 'Card content (markdown supported)',
      },
    },
    required: ['chat_id', 'content'],
  },
};

// Load lark-cli config
function loadLarkConfig(): { appId: string; appSecret: string; domain: lark.Domain } | null {
  // First check environment variables
  const envAppId = process.env.LARK_APP_ID;
  const envAppSecret = process.env.LARK_APP_SECRET;

  if (envAppId && envAppSecret) {
    return {
      appId: envAppId,
      appSecret: envAppSecret,
      domain: process.env.LARK_DOMAIN === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
    };
  }

  // Fall back to lark-cli config
  const configPath = join(homedir(), '.lark-cli', 'config.json');

  if (!existsSync(configPath)) {
    console.error('Lark config not found. Set LARK_APP_ID and LARK_APP_SECRET environment variables.');
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    const appConfig = config.apps?.[0] || config;

    if (!appConfig.appId || !appConfig.appSecret) {
      console.error('Invalid lark-cli config: missing appId or appSecret');
      return null;
    }

    return {
      appId: appConfig.appId,
      appSecret: appConfig.appSecret,
      domain: appConfig.brand === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
    };
  } catch (error) {
    console.error('Failed to load lark-cli config:', error);
    return null;
  }
}

// Create lark client
let larkClient: lark.Client | null = null;

function getLarkClient(): lark.Client | null {
  if (larkClient) return larkClient;

  const config = loadLarkConfig();
  if (!config) return null;

  larkClient = new lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: config.domain,
  });

  return larkClient;
}

// Send text message
async function sendText(chatId: string, text: string): Promise<{ success: boolean; error?: string }> {
  const client = getLarkClient();
  if (!client) {
    return { success: false, error: 'Lark client not configured' };
  }

  try {
    await client.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text }),
        msg_type: 'text',
      },
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to send text message:', message);
    return { success: false, error: message };
  }
}

// Send card message
async function sendCard(
  chatId: string,
  content: string,
  title?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getLarkClient();
  if (!client) {
    return { success: false, error: 'Lark client not configured' };
  }

  try {
    const card = lark.messageCard.defaultCard({
      title: title || '',
      content,
    });

    await client.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId,
        content: card,
        msg_type: 'interactive',
      },
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to send card message:', message);
    return { success: false, error: message };
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'feishu-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [SEND_TEXT_TOOL, SEND_CARD_TOOL],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');
  }

  switch (name) {
    case 'send_text': {
      const { chat_id, text } = args as { chat_id: string; text: string };
      if (!chat_id || !text) {
        throw new McpError(ErrorCode.InvalidParams, 'Missing chat_id or text');
      }
      const result = await sendText(chat_id, text);
      return {
        content: [
          {
            type: 'text',
            text: result.success ? 'Message sent successfully' : `Failed to send message: ${result.error}`,
          },
        ],
      };
    }

    case 'send_card': {
      const { chat_id, content, title } = args as { chat_id: string; content: string; title?: string };
      if (!chat_id || !content) {
        throw new McpError(ErrorCode.InvalidParams, 'Missing chat_id or content');
      }
      const result = await sendCard(chat_id, content, title);
      return {
        content: [
          {
            type: 'text',
            text: result.success ? 'Card sent successfully' : `Failed to send card: ${result.error}`,
          },
        ],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Feishu MCP server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
