import { setTimeout as sleep } from 'timers/promises';
import { log } from '../utils/logger.js';
import type { GatewayFeatureRunner } from '../gateway/features/index.js';
import {
  dispatchTracebackDetected,
  hashTracebackContent,
  listEnabledWebMonitorServices,
  updateWebMonitorServiceHash,
  type WebMonitorService,
} from '../gateway/features/web-monitor/index.js';

const DEFAULT_POLL_INTERVAL_SEC = 60;
const FETCH_TIMEOUT_MS = 10000;
const MAX_CONTENT_SIZE = 10240; // 10KB — truncate before hashing
const DEFAULT_GLOBAL_INTERVAL_SEC = 60;

export class TracebackMonitor {
  private running = false;
  private globalIntervalSec: number;
  private gatewayRunner?: GatewayFeatureRunner;

  constructor(options?: { globalIntervalSec?: number; gatewayRunner?: GatewayFeatureRunner }) {
    this.globalIntervalSec = options?.globalIntervalSec ?? DEFAULT_GLOBAL_INTERVAL_SEC;
    this.gatewayRunner = options?.gatewayRunner;
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    log.info('monitor', 'TracebackMonitor started');

    while (this.running) {
      try {
        await this.pollAll();
      } catch (error) {
        log.error('monitor', 'TracebackMonitor poll error', { error: String(error) });
      }
      await sleep(this.globalIntervalSec * 1000);
    }
  }

  stop(): void {
    this.running = false;
    log.info('monitor', 'TracebackMonitor stopped');
  }

  private async pollAll(): Promise<void> {
    const services = listEnabledWebMonitorServices();
    if (services.length === 0) {
      return;
    }

    const now = new Date();

    for (const service of services) {
      const intervalSec = service.pollIntervalSec ?? DEFAULT_POLL_INTERVAL_SEC;

      // Skip if checked recently (per-service interval)
      if (service.lastCheckedAt) {
        const elapsed = (now.getTime() - new Date(service.lastCheckedAt).getTime()) / 1000;
        if (elapsed < intervalSec) {
          continue;
        }
      }

      await this.pollService(service);
    }
  }

  private async pollService(service: WebMonitorService): Promise<void> {
    const now = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(service.tracebackUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        log.warn('monitor', `Traceback fetch failed for ${service.name}`, {
          status: response.status,
        });
        updateWebMonitorServiceHash(service.name, service.lastErrorHash ?? '', now);
        return;
      }

      let content = await response.text();

      // Truncate large content before hashing
      if (content.length > MAX_CONTENT_SIZE) {
        content = content.slice(0, MAX_CONTENT_SIZE);
      }

      const currentHash = hashTracebackContent(content);

      // Dedup: skip if same hash as last time
      if (currentHash === service.lastErrorHash) {
        updateWebMonitorServiceHash(service.name, currentHash, now);
        return;
      }

      // Skip on first check — just record the hash without triggering
      if (!service.lastErrorHash) {
        log.info('monitor', `Initial hash recorded for ${service.name}`);
        updateWebMonitorServiceHash(service.name, currentHash, now);
        return;
      }

      // New traceback detected — trigger repair
      log.info('monitor', `New traceback detected for ${service.name}`, {
        previousHash: service.lastErrorHash.slice(0, 12),
        currentHash: currentHash.slice(0, 12),
      });

      const previousHash = service.lastErrorHash;
      updateWebMonitorServiceHash(service.name, currentHash, now);

      await this.triggerRepair(service, content, previousHash, currentHash);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.warn('monitor', `Traceback poll error for ${service.name}`, { error: msg });
      updateWebMonitorServiceHash(service.name, service.lastErrorHash ?? '', now);
    }
  }

  private async triggerRepair(
    service: WebMonitorService,
    tracebackContent: string,
    previousHash?: string,
    currentHash?: string
  ): Promise<void> {
    log.info('monitor', `Triggering auto-repair for ${service.name}`);

    if (!this.gatewayRunner) {
      log.error('monitor', 'Gateway feature runner is not configured; traceback event skipped', {
        service: service.name,
      });
      return;
    }

    await dispatchTracebackDetected(this.gatewayRunner, {
      service,
      tracebackContent,
      previousHash,
      currentHash,
    });
  }
}
