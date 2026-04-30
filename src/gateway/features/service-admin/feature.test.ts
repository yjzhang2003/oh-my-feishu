import { afterEach, describe, expect, it } from 'vitest';
import { removeService } from '../../../service/registry.js';
import { serviceAdminFeature } from './feature.js';

describe('serviceAdminFeature', () => {
  afterEach(() => {
    removeService('test-gateway-service');
  });

  it('returns help output by default', async () => {
    const result = await serviceAdminFeature.handle({
      id: 'evt_1',
      type: 'service.command',
      source: 'feishu',
      payload: {},
      createdAt: '2026-04-30T00:00:00.000Z',
    }, {} as never);

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Service Commands');
  });

  it('adds and lists a service', async () => {
    const addResult = await serviceAdminFeature.handle({
      id: 'evt_add',
      type: 'service.command',
      source: 'feishu',
      payload: {
        action: 'add',
        name: 'test-gateway-service',
        repo: 'org/repo',
        tracebackUrl: 'https://logs.example.com/test',
        notifyChatId: 'oc_test',
        addedBy: 'ou_test',
      },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, {} as never);

    expect(addResult.success).toBe(true);
    expect(addResult.data?.title).toBe('Service Registered');

    const listResult = await serviceAdminFeature.handle({
      id: 'evt_list',
      type: 'service.command',
      source: 'feishu',
      payload: { action: 'list' },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, {} as never);

    expect(listResult.success).toBe(true);
    expect(listResult.data?.elements).toEqual(
      expect.arrayContaining([expect.stringContaining('test-gateway-service')])
    );
  });

  it('validates input for add', async () => {
    const result = await serviceAdminFeature.handle({
      id: 'evt_bad',
      type: 'service.command',
      source: 'feishu',
      payload: {
        action: 'add',
        name: 'bad',
        repo: 'invalid-repo',
        tracebackUrl: 'not-a-url',
      },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, {} as never);

    expect(result.success).toBe(false);
    expect(result.data?.title).toBe('Invalid repo format');
  });
});
