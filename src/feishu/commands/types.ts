/**
 * Command handler types
 */

export interface CommandContext {
  chatId: string;
  senderOpenId: string;
  chatType: string;
  messageId: string;
  args: string[];
  connected?: boolean;
  sendText: (text: string) => Promise<void>;
  sendCard: (card: { title: string; elements: string[] }) => Promise<void>;
}

export interface CommandHandler {
  name: string;
  aliases?: string[];
  description: string;
  execute(ctx: CommandContext): Promise<void>;
}
