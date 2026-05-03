import { describe, expect, it, vi } from 'vitest';
import { webMonitorFeature } from './feature.js';
import { updateWebMonitorClaudeRun } from './registry.js';
import type { GatewayRuntime } from '../types.js';

vi.mock('./registry.js', () => ({
  updateWebMonitorClaudeRun: vi.fn(),
}));

function runtime(): GatewayRuntime {
  return {
    invokeMainClaude: vi.fn(async () => ({
      success: true,
      stdout: 'fixed traceback',
      stderr: '',
      exitCode: 0,
    })),
    sendFeishuMessage: vi.fn(async () => {}),
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe('webMonitorFeature', () => {
  it('invokes main Claude with traceback payload and sends final notification', async () => {
    const rt = runtime();
    const result = await webMonitorFeature.handle({
      id: 'evt_1',
      type: 'traceback.detected',
      source: 'timer',
      payload: {
        serviceName: 'api',
        githubOwner: 'org',
        githubRepo: 'api',
        localRepoPath: '/tmp/workspace/services/api',
        tracebackUrl: 'https://logs.example.com/api',
        tracebackContent: 'Traceback...',
        notifyChatId: 'oc_123',
      },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, rt);

    expect(result.success).toBe(true);
    expect(rt.invokeMainClaude).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'web-monitor',
      skillCommand: '/web-monitor-auto-repair',
      context: expect.objectContaining({
        serviceName: 'api',
        repo: 'org/api',
        tracebackContent: 'Traceback...',
        localRepoPath: '/tmp/workspace/services/api',
      }),
      env: expect.objectContaining({
        SERVICE_NAME: 'api',
        NOTIFY_CHAT_ID: 'oc_123',
        TARGET_REPO_PATH: '/tmp/workspace/services/api',
      }),
    }));
    expect(updateWebMonitorClaudeRun).toHaveBeenCalledWith('api', expect.objectContaining({
      success: true,
      summary: 'fixed traceback',
      finishedAt: expect.any(String),
    }));
    expect(rt.sendFeishuMessage).toHaveBeenCalledWith({
      chatId: 'oc_123',
      content: 'fixed traceback',
    });
  });

  it('does not notify Feishu when notifyChatId is absent', async () => {
    const rt = runtime();
    await webMonitorFeature.handle({
      id: 'evt_1',
      type: 'traceback.detected',
      source: 'internal',
      payload: {
        serviceName: 'api',
        githubOwner: 'org',
        githubRepo: 'api',
        tracebackUrl: 'https://logs.example.com/api',
        tracebackContent: 'Traceback...',
      },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, rt);

    expect(rt.invokeMainClaude).toHaveBeenCalledOnce();
    expect(rt.sendFeishuMessage).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads', async () => {
    await expect(webMonitorFeature.handle({
      id: 'evt_1',
      type: 'traceback.detected',
      source: 'timer',
      payload: {},
      createdAt: '2026-04-30T00:00:00.000Z',
    }, runtime())).rejects.toThrow(/missing "serviceName"/);
  });
});
