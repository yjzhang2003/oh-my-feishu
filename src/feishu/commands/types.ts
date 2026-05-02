/**
 * Command handler types
 */

export interface CommandContext {
  chatId: string;
  senderOpenId: string;
  chatType: string;
  messageId: string;
  args: string[];
  sessionMode?: 'direct' | 'directory';
  sessionDirectory?: string;
  connected?: boolean;
  gatewayFeatureRunner?: import('../../gateway/features/index.js').GatewayFeatureRunner;
  sendText: (text: string) => Promise<void>;
  sendCard: (card: object) => Promise<void>;
  sendMenuCard: () => Promise<void>;
  cardKitManager?: import('../card-kit.js').CardKitManager;
  sendCardById?: (cardId: string) => Promise<void>;
}

export interface CommandHandler {
  name: string;
  aliases?: string[];
  description: string;
  execute(ctx: CommandContext): Promise<void>;
}
