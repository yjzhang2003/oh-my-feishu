import { describe, expect, it } from 'vitest';
import { GatewayFeatureRegistry } from './registry.js';
import type { GatewayFeature } from './types.js';

function feature(name: string, type: string, source?: 'feishu' | 'timer'): GatewayFeature {
  return {
    name,
    triggers: [{ type, source }],
    async handle() {
      return { success: true };
    },
  };
}

describe('GatewayFeatureRegistry', () => {
  it('registers and lists features', () => {
    const registry = new GatewayFeatureRegistry();
    registry.register(feature('web-monitor', 'traceback.detected', 'timer'));

    expect(registry.get('web-monitor')?.name).toBe('web-monitor');
    expect(registry.list()).toHaveLength(1);
  });

  it('rejects duplicate feature names', () => {
    const registry = new GatewayFeatureRegistry();
    registry.register(feature('web-monitor', 'traceback.detected'));

    expect(() => registry.register(feature('web-monitor', 'manual.run'))).toThrow(/already registered/);
  });

  it('matches by explicit feature first', () => {
    const registry = new GatewayFeatureRegistry();
    registry.register(feature('web-monitor', 'traceback.detected', 'timer'));

    const matched = registry.match({
      id: 'evt_1',
      type: 'different.type',
      source: 'internal',
      feature: 'web-monitor',
      payload: {},
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    expect(matched?.name).toBe('web-monitor');
  });

  it('matches by trigger type and source', () => {
    const registry = new GatewayFeatureRegistry();
    registry.register(feature('web-monitor', 'traceback.detected', 'timer'));
    registry.register(feature('service-command', 'service.command', 'feishu'));

    const matched = registry.match({
      id: 'evt_1',
      type: 'traceback.detected',
      source: 'timer',
      payload: {},
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    expect(matched?.name).toBe('web-monitor');
  });

  it('does not match source-specific trigger from another source', () => {
    const registry = new GatewayFeatureRegistry();
    registry.register(feature('web-monitor', 'traceback.detected', 'timer'));

    const matched = registry.match({
      id: 'evt_1',
      type: 'traceback.detected',
      source: 'webhook',
      payload: {},
      createdAt: '2026-04-30T00:00:00.000Z',
    });

    expect(matched).toBeUndefined();
  });
});
