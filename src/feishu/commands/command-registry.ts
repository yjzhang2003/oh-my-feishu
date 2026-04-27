import type { CommandHandler } from './types.js';

export class CommandRegistry {
  private handlers = new Map<string, CommandHandler>();

  register(handler: CommandHandler): void {
    this.handlers.set(handler.name, handler);
    if (handler.aliases) {
      for (const alias of handler.aliases) {
        this.handlers.set(alias, handler);
      }
    }
  }

  find(command: string): CommandHandler | undefined {
    return this.handlers.get(command);
  }

  list(): CommandHandler[] {
    // Deduplicate by handler reference (aliases point to same handler)
    const seen = new Set<CommandHandler>();
    const result: CommandHandler[] = [];
    for (const handler of this.handlers.values()) {
      if (!seen.has(handler)) {
        seen.add(handler);
        result.push(handler);
      }
    }
    return result;
  }
}
