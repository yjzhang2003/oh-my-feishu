import { createHash } from 'crypto';

/**
 * Generate a deterministic UUID from chat ID for session persistence
 */
export function chatIdToSessionId(chatId: string): string {
  const hash = createHash('sha256').update(chatId).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-${(parseInt(hash.slice(15, 16), 16) & 0x3 | 0x8).toString(16)}${hash.slice(16, 19)}-${hash.slice(19, 31)}`;
}
