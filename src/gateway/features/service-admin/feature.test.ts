import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceAdminFeature } from './feature.js';
import { cloneServiceRepository } from '../../../service/repository.js';

const registry = vi.hoisted(() => ({
  services: [] as Array<{
    name: string;
    githubOwner: string;
    githubRepo: string;
    tracebackUrl: string;
    notifyChatId: string;
    tracebackUrlType: 'json';
    enabled: boolean;
    addedAt: string;
    addedBy: string;
    lastCheckedAt?: string;
    localRepoPath?: string;
  }>,
}));

vi.mock('../../../service/registry.js', () => ({
  addService: vi.fn((entry) => {
    if (registry.services.some((service) => service.name === entry.name)) {
      throw new Error(`Service "${entry.name}" already exists`);
    }
    registry.services.push(entry);
    return entry;
  }),
  listServices: vi.fn(() => registry.services),
  getService: vi.fn((name: string) => registry.services.find((service) => service.name === name) ?? null),
  removeService: vi.fn((name: string) => {
    const index = registry.services.findIndex((service) => service.name === name);
    if (index === -1) return false;
    registry.services.splice(index, 1);
    return true;
  }),
  updateService: vi.fn((name: string, updates: Record<string, unknown>) => {
    const service = registry.services.find((service) => service.name === name);
    if (!service) return null;
    Object.assign(service, updates);
    return service;
  }),
}));

vi.mock('../../../service/repository.js', () => ({
  cloneServiceRepository: vi.fn(async ({ serviceName }) => `/tmp/workspace/services/${serviceName}`),
  removeServiceRepository: vi.fn(),
}));

describe('serviceAdminFeature', () => {
  beforeEach(() => {
    registry.services.length = 0;
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
    expect(cloneServiceRepository).toHaveBeenCalledWith({
      serviceName: 'test-gateway-service',
      owner: 'org',
      repo: 'repo',
    });
    expect(registry.services[0].localRepoPath).toBe('/tmp/workspace/services/test-gateway-service');

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

  it('does not register service when shallow clone fails', async () => {
    vi.mocked(cloneServiceRepository).mockRejectedValueOnce(new Error('clone failed'));

    const result = await serviceAdminFeature.handle({
      id: 'evt_clone_fail',
      type: 'service.command',
      source: 'feishu',
      payload: {
        action: 'add',
        name: 'clone-fail',
        repo: 'org/repo',
        tracebackUrl: 'https://logs.example.com/test',
      },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, {} as never);

    expect(result.success).toBe(false);
    expect(registry.services).toHaveLength(0);
    expect(result.message).toBe('clone failed');
  });
});
