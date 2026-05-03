import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import {
  loadRegistry,
  saveRegistry,
  addService,
  removeService,
  getService,
  listServices,
  listEnabledServices,
  updateService,
  updateServiceErrorHash,
  hashContent,
  getRegistryPath,
  type ServiceEntry,
} from './registry.js';

const TEST_DIR = resolve(process.cwd(), 'tmp-test-registry');
const TEST_REGISTRY_PATH = resolve(TEST_DIR, 'services.json');

beforeEach(() => {
  process.env.OH_MY_FEISHU_SERVICE_REGISTRY_PATH = TEST_REGISTRY_PATH;
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  delete process.env.OH_MY_FEISHU_SERVICE_REGISTRY_PATH;
});

const sampleEntry: ServiceEntry = {
  name: 'test-api',
  githubOwner: 'myorg',
  githubRepo: 'test-api',
  tracebackUrl: 'https://logs.example.com/api/tracebacks',
  notifyChatId: 'oc_test123',
  tracebackUrlType: 'json',
  enabled: true,
  addedAt: '2026-01-01T00:00:00.000Z',
  addedBy: 'cli',
};

describe('hashContent', () => {
  it('returns a consistent SHA-256 hex string', () => {
    const hash1 = hashContent('hello world');
    const hash2 = hashContent('hello world');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hashes for different content', () => {
    const hash1 = hashContent('hello');
    const hash2 = hashContent('world');
    expect(hash1).not.toBe(hash2);
  });
});

describe('ServiceRegistry file operations', () => {
  it('loadRegistry returns empty registry when file does not exist', () => {
    const registry = loadRegistry();
    expect(registry.version).toBe(1);
    expect(Array.isArray(registry.services)).toBe(true);
  });

  it('loadRegistry handles corrupt JSON gracefully', () => {
    writeFileSync(TEST_REGISTRY_PATH, '{bad json');
    const registry = loadRegistry();
    expect(registry.version).toBe(1);
    expect(registry.services).toEqual([]);
  });

  it('saveRegistry and loadRegistry round-trip', () => {
    const registry = {
      version: 1,
      services: [sampleEntry],
    };
    saveRegistry(registry);
    const loaded = loadRegistry();
    expect(loaded.services.length).toBe(1);
    expect(loaded.services[0].name).toBe('test-api');
    expect(loaded.services[0].githubOwner).toBe('myorg');
    expect(getRegistryPath()).toBe(TEST_REGISTRY_PATH);
  });
});

describe('addService', () => {
  afterEach(() => {
    // Clean up: remove any added services
    const registry = loadRegistry();
    for (const s of registry.services) {
      if (s.name.startsWith('test-')) {
        removeService(s.name);
      }
    }
  });

  it('adds a service entry', () => {
    const entry = addService({
      ...sampleEntry,
      name: 'test-add-1',
      addedAt: new Date().toISOString(),
    });
    expect(entry.name).toBe('test-add-1');

    const found = getService('test-add-1');
    expect(found).not.toBeNull();
    expect(found!.githubRepo).toBe('test-api');
  });

  it('rejects duplicate service names', () => {
    addService({
      ...sampleEntry,
      name: 'test-dup',
      addedAt: new Date().toISOString(),
    });

    expect(() => {
      addService({
        ...sampleEntry,
        name: 'test-dup',
        addedAt: new Date().toISOString(),
      });
    }).toThrow(/already exists/);
  });
});

describe('removeService', () => {
  it('removes an existing service', () => {
    addService({
      ...sampleEntry,
      name: 'test-remove-1',
      addedAt: new Date().toISOString(),
    });

    const result = removeService('test-remove-1');
    expect(result).toBe(true);

    const found = getService('test-remove-1');
    expect(found).toBeNull();
  });

  it('returns false for non-existing service', () => {
    const result = removeService('nonexistent-service');
    expect(result).toBe(false);
  });
});

describe('getService', () => {
  it('returns null for non-existing service', () => {
    const found = getService('nonexistent-service');
    expect(found).toBeNull();
  });

  it('returns the correct service entry', () => {
    addService({
      ...sampleEntry,
      name: 'test-get-1',
      tracebackUrl: 'https://example.com/logs',
      addedAt: new Date().toISOString(),
    });

    const found = getService('test-get-1');
    expect(found).not.toBeNull();
    expect(found!.tracebackUrl).toBe('https://example.com/logs');
  });
});

describe('listServices and listEnabledServices', () => {
  it('lists all services', () => {
    const before = listServices().length;
    addService({
      ...sampleEntry,
      name: 'test-list-1',
      addedAt: new Date().toISOString(),
    });

    const after = listServices().length;
    expect(after).toBe(before + 1);
  });

  it('listEnabledServices filters by enabled flag', () => {
    addService({
      ...sampleEntry,
      name: 'test-enabled-1',
      enabled: true,
      addedAt: new Date().toISOString(),
    });

    addService({
      ...sampleEntry,
      name: 'test-enabled-2',
      enabled: false,
      addedAt: new Date().toISOString(),
    });

    const all = listServices();
    const enabled = listEnabledServices();
    const testServices = all.filter(s => s.name.startsWith('test-enabled-'));
    const testEnabled = enabled.filter(s => s.name.startsWith('test-enabled-'));
    expect(testServices.length).toBe(2);
    expect(testEnabled.length).toBe(1);
  });
});

describe('updateService', () => {
  it('updates specified fields', () => {
    addService({
      ...sampleEntry,
      name: 'test-update-1',
      enabled: true,
      addedAt: new Date().toISOString(),
    });

    const updated = updateService('test-update-1', { enabled: false });
    expect(updated).not.toBeNull();
    expect(updated!.enabled).toBe(false);

    const found = getService('test-update-1');
    expect(found!.enabled).toBe(false);
  });

  it('returns null for non-existing service', () => {
    const result = updateService('nonexistent', { enabled: false });
    expect(result).toBeNull();
  });
});

describe('updateServiceErrorHash', () => {
  it('updates lastErrorHash and lastCheckedAt', () => {
    addService({
      ...sampleEntry,
      name: 'test-hash-1',
      addedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    updateServiceErrorHash('test-hash-1', 'abc123', now);

    const found = getService('test-hash-1');
    expect(found!.lastErrorHash).toBe('abc123');
    expect(found!.lastCheckedAt).toBe(now);
  });
});
