import { invokeClaudeTask } from '../../trigger/invoker.js';
import type { ClaudeTaskInput, FeishuCardUpdateInput, FeishuSendCardInput, FeishuSendInput, GatewayRuntime } from './types.js';
import { log } from '../../utils/logger.js';

export interface GatewayRuntimeOptions {
  sendTextMessage?: (chatId: string, text: string) => Promise<void>;
  sendCardMessage?: (chatId: string, card: object) => Promise<void>;
  updateCard?: (input: FeishuCardUpdateInput) => Promise<boolean>;
}

export function createGatewayRuntime(options: GatewayRuntimeOptions = {}): GatewayRuntime {
  return {
    invokeMainClaude(input: ClaudeTaskInput) {
      return invokeClaudeTask(input);
    },

    async sendFeishuMessage(input: FeishuSendInput) {
      if (!options.sendTextMessage) {
        throw new Error('GatewayRuntime sendTextMessage is not configured');
      }
      await options.sendTextMessage(input.chatId, input.content);
    },

    async sendFeishuCard(input: FeishuSendCardInput) {
      if (!options.sendCardMessage) {
        throw new Error('GatewayRuntime sendCardMessage is not configured');
      }
      await options.sendCardMessage(input.chatId, input.card);
    },

    updateCard: options.updateCard,

    log,
  };
}
