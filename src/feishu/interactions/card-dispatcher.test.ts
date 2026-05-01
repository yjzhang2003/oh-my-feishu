import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardDispatcher } from './card-dispatcher.js';
import { SessionHistoryStore } from './session-history-store.js';
import { SessionStore } from './session-store.js';
import type { GatewayFeatureRunner } from '../../gateway/features/index.js';
import { listSessions } from '../../trigger/invoker.js';
import { install } from '../../marketplace/index.js';

vi.mock('../../trigger/invoker.js', () => ({
  listSessions: vi.fn(),
}));

vi.mock('../../marketplace/index.js', () => ({
  install: vi.fn().mockResolvedValue(undefined),
}));

describe('CardDispatcher', () => {
  let sessionStore: SessionStore | null = null;
  const tempDirs: string[] = [];

  afterEach(() => {
    sessionStore?.destroy();
    sessionStore = null;
    vi.clearAllMocks();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('submits web monitor form through the Gateway service-admin feature', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oh-my-feishu-dispatcher-'));
    tempDirs.push(tempDir);
    sessionStore = new SessionStore();
    const run = vi.fn().mockResolvedValue({ success: true, data: { title: 'Service Registered' } });
    const dispatcher = new CardDispatcher(
      sessionStore,
      new SessionHistoryStore(tempDir),
      {} as any,
      vi.fn(),
      { run } as unknown as GatewayFeatureRunner
    );

    const response = await dispatcher.dispatch({
      operator: { open_id: 'ou_test' },
      context: { open_chat_id: 'oc_test' },
      action: {
        tag: 'button',
        form_value: {
          wm_name: 'my-api',
          wm_repo: 'owner/repo',
          wm_url: 'https://example.com/traceback',
        },
      },
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({
      feature: 'service-admin',
      type: 'service.command',
      source: 'feishu',
      chatId: 'oc_test',
      senderOpenId: 'ou_test',
      payload: {
        action: 'add',
        name: 'my-api',
        repo: 'owner/repo',
        tracebackUrl: 'https://example.com/traceback',
        notifyChatId: 'oc_test',
        addedBy: 'ou_test',
      },
    });
    expect(response.toast).toEqual({ type: 'success', content: '已创建监控：my-api' });
    expect(response.card?.type).toBe('raw');
  });

  it('returns a clickable session selection card when a directory has Claude sessions', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oh-my-feishu-session-'));
    tempDirs.push(tempDir);
    vi.mocked(listSessions).mockResolvedValue([
      { id: 'session-a', lastActive: '2026-05-01T10:00:00Z' },
      { id: 'session-b', lastActive: '2026-05-01T11:00:00Z' },
    ]);
    sessionStore = new SessionStore();
    const dispatcher = new CardDispatcher(
      sessionStore,
      new SessionHistoryStore(tempDir),
      {} as any,
      vi.fn()
    );

    const response = await dispatcher.dispatch({
      operator: { open_id: 'ou_test' },
      context: { open_chat_id: 'oc_test' },
      action: {
        tag: 'button',
        form_value: {
          dir_path: tempDir,
        },
      },
    });

    expect(response.card?.type).toBe('raw');
    expect(response.card?.data).toMatchObject({ schema: '2.0' });
    expect(JSON.stringify(response.card?.data)).toContain('session:select:session-a');
    expect(JSON.stringify(response.card?.data)).toContain('session:select:session-b');
    expect(JSON.stringify(response.card?.data)).toContain('session:select:new');
    expect(sessionStore.get('oc_test')).toMatchObject({
      flow: 'session-select-session',
      data: { directory: tempDir },
    });
  });

  it('selects an existing Claude session from the card and stores its session id', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oh-my-feishu-session-'));
    tempDirs.push(tempDir);
    vi.mocked(listSessions).mockResolvedValue([
      { id: 'session-a', lastActive: '2026-05-01T10:00:00Z' },
      { id: 'session-b', lastActive: '2026-05-01T11:00:00Z' },
    ]);
    sessionStore = new SessionStore();
    const historyStore = new SessionHistoryStore(tempDir);
    sessionStore.set('oc_test', {
      flow: 'session-select-session',
      data: { directory: tempDir },
    });
    const dispatcher = new CardDispatcher(
      sessionStore,
      historyStore,
      {} as any,
      vi.fn()
    );

    const response = await dispatcher.dispatch({
      operator: { open_id: 'ou_test' },
      context: { open_chat_id: 'oc_test' },
      action: {
        value: {
          action: 'session:select:session-b',
        },
      },
    });

    expect(install).toHaveBeenCalledWith({ targetDir: tempDir });
    expect(sessionStore.get('oc_test')).toMatchObject({
      flow: 'none',
      mode: 'directory',
      data: { directory: tempDir, sessionId: 'session-b' },
    });
    expect(historyStore.listHistory('oc_test')[0]).toMatchObject({
      directory: tempDir,
      sessionId: 'session-b',
    });
    expect(response.card?.type).toBe('raw');
    expect(response.card?.data).toMatchObject({ schema: '2.0' });
    expect(response.toast).toEqual({ type: 'success', content: '已连接 Claude Code 会话' });
  });

  it('returns the new directory session card without waiting for plugin install', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oh-my-feishu-session-'));
    tempDirs.push(tempDir);
    vi.mocked(listSessions).mockResolvedValue([]);
    vi.mocked(install).mockImplementationOnce(() => new Promise(() => {}));
    sessionStore = new SessionStore();
    const dispatcher = new CardDispatcher(
      sessionStore,
      new SessionHistoryStore(tempDir),
      {} as any,
      vi.fn()
    );

    const response = await dispatcher.dispatch({
      operator: { open_id: 'ou_test' },
      context: { open_chat_id: 'oc_test' },
      action: {
        tag: 'button',
        form_value: {
          dir_path: tempDir,
        },
      },
    });

    expect(install).toHaveBeenCalledWith({ targetDir: tempDir });
    expect(response.card?.type).toBe('raw');
    expect(response.card?.data).toMatchObject({ schema: '2.0' });
    expect(response.toast).toEqual({ type: 'success', content: '目录会话已创建' });
    expect(sessionStore.get('oc_test')).toMatchObject({
      flow: 'none',
      mode: 'directory',
      data: { directory: tempDir },
    });
  });
});
