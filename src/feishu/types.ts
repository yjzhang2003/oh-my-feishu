/**
 * Shared types for Feishu card interactions
 */

export interface SendCardFn {
  (chatId: string, card: object): Promise<void>;
}
