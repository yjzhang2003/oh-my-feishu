/**
 * Session state store - in-memory per chatId session management
 * Auto-cleanup of expired sessions (30 min TTL)
 */

export type InteractionFlow =
  | 'none'
  | 'service-add-step1'
  | 'service-add-step2'
  | 'service-add-step3'
  | 'repair-context';

export type SessionMode = 'direct' | 'directory';

export interface SessionState {
  chatId: string;
  flow: InteractionFlow;
  data: Record<string, unknown>;
  hasReceivedNav: boolean;
  mode: SessionMode;
  updatedAt: Date;
}

const DEFAULT_STATE: Omit<SessionState, 'chatId'> = {
  flow: 'none',
  data: {},
  hasReceivedNav: false,
  mode: 'direct',
  updatedAt: new Date(),
};

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SessionStore {
  private sessions = new Map<string, SessionState>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
  }

  get(chatId: string): SessionState {
    const existing = this.sessions.get(chatId);
    if (existing) {
      // Check TTL
      if (Date.now() - existing.updatedAt.getTime() > SESSION_TTL_MS) {
        this.sessions.delete(chatId);
        return { ...DEFAULT_STATE, chatId, updatedAt: new Date() };
      }
      return existing;
    }
    return { ...DEFAULT_STATE, chatId, updatedAt: new Date() };
  }

  set(chatId: string, state: Partial<SessionState>): void {
    const current = this.get(chatId);
    this.sessions.set(chatId, {
      ...current,
      ...state,
      chatId,
      updatedAt: new Date(),
    });
  }

  clear(chatId: string): void {
    this.sessions.delete(chatId);
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [chatId, session] of this.sessions) {
      if (now - session.updatedAt.getTime() > SESSION_TTL_MS) {
        this.sessions.delete(chatId);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
