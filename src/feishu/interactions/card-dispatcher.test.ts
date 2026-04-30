import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardDispatcher } from './card-dispatcher.js';
import { SessionHistoryStore } from './session-history-store.js';
import { SessionStore } from './session-store.js';
import type { GatewayFeatureRunner } from '../../gateway/features/index.js';

describe('CardDispatcher', () => {
  let sessionStore: SessionStore | null = null;
  const tempDirs: string[] = [];

  afterEach(() => {
    sessionStore?.destroy();
    sessionStore = null;
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
});
