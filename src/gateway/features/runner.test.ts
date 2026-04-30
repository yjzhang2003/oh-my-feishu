import { describe, expect, it, vi } from 'vitest';
import { GatewayFeatureRegistry } from './registry.js';
import { createGatewayEvent, GatewayFeatureRunner } from './runner.js';
import type { GatewayRuntime } from './types.js';

function runtime(): GatewayRuntime {
  return {
    invokeMainClaude: vi.fn(async () => ({
      success: true,
      stdout: 'final result',
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

describe('GatewayFeatureRunner', () => {
  it('runs matched feature and returns its result', async () => {
    const registry = new GatewayFeatureRegistry();
    const rt = runtime();

    registry.register({
      name: 'web-monitor',
      triggers: [{ type: 'traceback.detected', source: 'timer' }],
      async handle(event, runtime) {
        const claude = await runtime.invokeMainClaude({
          feature: 'web-monitor',
          instruction: 'Repair traceback',
          context: { event },
        });
        return {
          success: claude.success,
          message: claude.stdout,
          claude,
        };
      },
    });

    const runner = new GatewayFeatureRunner({ registry, runtime: rt });
    const result = await runner.run(createGatewayEvent({
      type: 'traceback.detected',
      source: 'timer',
      payload: { service: 'api' },
    }));

    expect(result.success).toBe(true);
    expect(result.message).toBe('final result');
    expect(rt.invokeMainClaude).toHaveBeenCalledOnce();
    expect(rt.sendFeishuMessage).not.toHaveBeenCalled();
  });

  it('lists registered features for IPC callers', () => {
    const registry = new GatewayFeatureRegistry();
    registry.register({
      name: 'status',
      triggers: [{ type: 'status.query', source: 'feishu' }],
      async handle() {
        return { success: true };
      },
    });

    const runner = new GatewayFeatureRunner({ registry, runtime: runtime() });

    expect(runner.listFeatures()).toEqual([
      { name: 'status', triggers: ['status.query'] },
    ]);
  });

  it('returns failed result when no feature matches', async () => {
    const runner = new GatewayFeatureRunner({
      registry: new GatewayFeatureRegistry(),
      runtime: runtime(),
    });

    const result = await runner.run(createGatewayEvent({
      type: 'unknown',
      source: 'internal',
      payload: {},
    }));

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No Gateway feature matched/);
  });

  it('converts feature exceptions to failed results', async () => {
    const registry = new GatewayFeatureRegistry();
    registry.register({
      name: 'broken',
      triggers: [{ type: 'broken.run' }],
      async handle() {
        throw new Error('boom');
      },
    });

    const runner = new GatewayFeatureRunner({ registry, runtime: runtime() });
    const result = await runner.run(createGatewayEvent({
      type: 'broken.run',
      source: 'internal',
      payload: {},
    }));

    expect(result.success).toBe(false);
    expect(result.message).toBe('boom');
  });
});
