import { invokeClaudeTask } from '../../trigger/invoker.js';
import type { ClaudeTaskInput, FeishuSendInput, GatewayRuntime } from './types.js';
import { log } from '../../utils/logger.js';

export interface GatewayRuntimeOptions {
  sendTextMessage?: (chatId: string, text: string) => Promise<void>;
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

    log,
  };
}
