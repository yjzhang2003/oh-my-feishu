import { describe, expect, it } from 'vitest';
import { statusFeature } from './feature.js';

describe('statusFeature', () => {
  it('returns system status text', async () => {
    const result = await statusFeature.handle({
      id: 'evt_1',
      type: 'status.query',
      source: 'feishu',
      payload: { connected: true },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, {} as never);

    expect(result.success).toBe(true);
    expect(result.message).toContain('System Status');
    expect(result.message).toContain('WebSocket:** ✅ Connected');
    expect(result.data?.servicesRegistered).toEqual(expect.any(Number));
  });
});
