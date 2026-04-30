/**
 * Gateway session types
 */

export type SessionType = 'gateway-direct' | 'directory';

export interface Session {
  id: string;
  type: SessionType;
  chatId: string;
  directory?: string;  // 仅 directory session 有
  createdAt: Date;
}

export interface SessionMessage {
  type: 'message' | 'create' | 'destroy' | 'list' | 'gateway:list' | 'gateway:trigger';
  sessionId?: string;
  chatId?: string;
  directory?: string;
  content?: string;
  senderOpenId?: string;
  messageId?: string;
  feature?: string;
  eventType?: string;
  source?: 'feishu' | 'timer' | 'webhook' | 'cli' | 'internal';
  payload?: unknown;
}

export interface SessionInfo {
  id: string;
  type: SessionType;
  chatId: string;
  directory?: string;
  createdAt: string;
}
