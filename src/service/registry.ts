import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { createHash } from 'crypto';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

const DEFAULT_REGISTRY_PATH = resolve(env.REPO_ROOT, 'workspace', '.claude', 'services.json');

export interface ServiceEntry {
  name: string;
  githubOwner: string;
  githubRepo: string;
  localRepoPath?: string;
  tracebackUrl: string;
  notifyChatId: string;
  tracebackUrlType: 'json' | 'text' | 'html';
  pollIntervalSec?: number;
  autoPr?: boolean;
  prBaseBranch?: string;
  prDraft?: boolean;
  prBranchPrefix?: string;
  requireConfirmation?: boolean;
  enabled: boolean;
  addedAt: string;
  addedBy: string;
  lastErrorHash?: string;
  lastCheckedAt?: string;
  lastTracebackAt?: string;
  lastTracebackPreview?: string;
  lastClaudeRunAt?: string;
  lastClaudeRunSuccess?: boolean;
  lastClaudeRunSummary?: string;
}

export interface ServiceRegistry {
  version: number;
  services: ServiceEntry[];
}

function ensureRegistryDir(): void {
  const registryDir = dirname(getRegistryPath());
  if (!existsSync(registryDir)) {
    mkdirSync(registryDir, { recursive: true });
  }
}

export function loadRegistry(): ServiceRegistry {
  const registryPath = getRegistryPath();
  if (!existsSync(registryPath)) {
    return { version: 1, services: [] };
  }

  try {
    const content = readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(content) as ServiceRegistry;
    if (!parsed.version || !Array.isArray(parsed.services)) {
      log.warn('service', 'Invalid registry format, returning empty');
      return { version: 1, services: [] };
    }
    return parsed;
  } catch {
    log.warn('service', 'Corrupt registry file, returning empty');
    return { version: 1, services: [] };
  }
}

export function saveRegistry(registry: ServiceRegistry): void {
  ensureRegistryDir();
  writeFileSync(getRegistryPath(), JSON.stringify(registry, null, 2));
}

export function addService(entry: ServiceEntry): ServiceEntry {
  const registry = loadRegistry();
  const existing = registry.services.find(s => s.name === entry.name);
  if (existing) {
    throw new Error(`Service "${entry.name}" already exists`);
  }

  registry.services.push(entry);
  saveRegistry(registry);
  log.info('service', `Added service: ${entry.name}`, { repo: `${entry.githubOwner}/${entry.githubRepo}` });
  return entry;
}

export function removeService(name: string): boolean {
  const registry = loadRegistry();
  const index = registry.services.findIndex(s => s.name === name);
  if (index === -1) {
    return false;
  }

  registry.services.splice(index, 1);
  saveRegistry(registry);
  log.info('service', `Removed service: ${name}`);
  return true;
}

export function getService(name: string): ServiceEntry | null {
  const registry = loadRegistry();
  return registry.services.find(s => s.name === name) ?? null;
}

export function listServices(): ServiceEntry[] {
  return loadRegistry().services;
}

export function listEnabledServices(): ServiceEntry[] {
  return loadRegistry().services.filter(s => s.enabled);
}

export function updateService(name: string, updates: Partial<ServiceEntry>): ServiceEntry | null {
  const registry = loadRegistry();
  const entry = registry.services.find(s => s.name === name);
  if (!entry) {
    return null;
  }

  Object.assign(entry, updates);
  saveRegistry(registry);
  log.info('service', `Updated service: ${name}`, { updatedFields: Object.keys(updates) });
  return entry;
}

export function updateServiceErrorHash(name: string, hash: string, checkedAt: string): void {
  const registry = loadRegistry();
  const entry = registry.services.find(s => s.name === name);
  if (!entry) {
    return;
  }

  entry.lastErrorHash = hash;
  entry.lastCheckedAt = checkedAt;
  saveRegistry(registry);
}

export function updateServiceTracebackSnapshot(name: string, preview: string, checkedAt: string): void {
  updateService(name, {
    lastCheckedAt: checkedAt,
    lastTracebackAt: checkedAt,
    lastTracebackPreview: preview,
  });
}

export function updateServiceClaudeRun(
  name: string,
  input: { success: boolean; summary: string; finishedAt: string }
): void {
  updateService(name, {
    lastClaudeRunAt: input.finishedAt,
    lastClaudeRunSuccess: input.success,
    lastClaudeRunSummary: input.summary,
  });
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function getRegistryPath(): string {
  return process.env.OH_MY_FEISHU_SERVICE_REGISTRY_PATH
    ? resolve(process.env.OH_MY_FEISHU_SERVICE_REGISTRY_PATH)
    : DEFAULT_REGISTRY_PATH;
}
