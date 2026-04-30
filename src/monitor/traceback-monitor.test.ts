import { describe, it, expect, afterEach, vi } from 'vitest';
import { TracebackMonitor } from './traceback-monitor.js';
import { addService, removeService, listServices, hashContent } from '../service/registry.js';
import type { GatewayFeatureRunner } from '../gateway/features/index.js';

describe('TracebackMonitor', () => {
  const monitor = new TracebackMonitor({ globalIntervalSec: 1 });

  afterEach(() => {
    monitor.stop();
    // Clean up test services
    for (const s of listServices()) {
      if (s.name.startsWith('test-tb-')) {
        removeService(s.name);
      }
    }
  });

  it('starts and stops without error', () => {
    expect(monitor.isRunning()).toBe(false);
    monitor.stop();
    expect(monitor.isRunning()).toBe(false);
  });

  it('hash-based dedup: same content produces same hash', () => {
    const traceback1 = 'Error in module X at line 10';
    const traceback2 = 'Error in module X at line 10';
    const traceback3 = 'Error in module Y at line 20';

    expect(hashContent(traceback1)).toBe(hashContent(traceback2));
    expect(hashContent(traceback1)).not.toBe(hashContent(traceback3));
  });

  it('truncation: large content still hashes consistently', () => {
    const largeContent = 'x'.repeat(20000);
    const truncated = largeContent.slice(0, 10240);

    expect(hashContent(truncated)).toBe(hashContent(truncated));
    expect(hashContent(truncated).length).toBe(64);
  });

  it('dispatches new traceback events through the Gateway feature runner', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const gatewayRunner = { run } as unknown as GatewayFeatureRunner;
    const gatewayMonitor = new TracebackMonitor({ globalIntervalSec: 1, gatewayRunner });
    const service = {
      name: 'test-tb-gateway',
      githubOwner: 'myorg',
      githubRepo: 'my-api',
      tracebackUrl: 'https://example.com/traceback',
      tracebackUrlType: 'json' as const,
      notifyChatId: 'oc_test',
      enabled: true,
      addedAt: new Date().toISOString(),
    };

    await (gatewayMonitor as any).triggerRepair(service, 'Error: boom', 'old-hash', 'new-hash');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({
      type: 'traceback.detected',
      source: 'timer',
      payload: {
        serviceName: 'test-tb-gateway',
        githubOwner: 'myorg',
        githubRepo: 'my-api',
        tracebackContent: 'Error: boom',
        previousHash: 'old-hash',
        currentHash: 'new-hash',
      },
    });
  });
});
