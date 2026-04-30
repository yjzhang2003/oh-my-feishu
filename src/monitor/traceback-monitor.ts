import { setTimeout as sleep } from 'timers/promises';
import { writeTrigger } from '../trigger/trigger.js';
import { invokeClaudeSkill } from '../trigger/invoker.js';
import {
  type ServiceEntry,
  listEnabledServices,
  updateServiceErrorHash,
  hashContent,
} from '../service/registry.js';
import { log } from '../utils/logger.js';
import { createGatewayEvent, type GatewayFeatureRunner } from '../gateway/features/index.js';

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
    const services = listEnabledServices();
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

  private async pollService(service: ServiceEntry): Promise<void> {
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
        updateServiceErrorHash(service.name, service.lastErrorHash ?? '', now);
        return;
      }

      let content = await response.text();

      // Truncate large content before hashing
      if (content.length > MAX_CONTENT_SIZE) {
        content = content.slice(0, MAX_CONTENT_SIZE);
      }

      const currentHash = hashContent(content);

      // Dedup: skip if same hash as last time
      if (currentHash === service.lastErrorHash) {
        updateServiceErrorHash(service.name, currentHash, now);
        return;
      }

      // Skip on first check — just record the hash without triggering
      if (!service.lastErrorHash) {
        log.info('monitor', `Initial hash recorded for ${service.name}`);
        updateServiceErrorHash(service.name, currentHash, now);
        return;
      }

      // New traceback detected — trigger repair
      log.info('monitor', `New traceback detected for ${service.name}`, {
        previousHash: service.lastErrorHash.slice(0, 12),
        currentHash: currentHash.slice(0, 12),
      });

      updateServiceErrorHash(service.name, currentHash, now);

      await this.triggerRepair(service, content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.warn('monitor', `Traceback poll error for ${service.name}`, { error: msg });
      updateServiceErrorHash(service.name, service.lastErrorHash ?? '', now);
    }
  }

  private async triggerRepair(service: ServiceEntry, tracebackContent: string): Promise<void> {
    log.info('monitor', `Triggering auto-repair for ${service.name}`);

    if (this.gatewayRunner) {
      await this.gatewayRunner.run(createGatewayEvent({
        type: 'traceback.detected',
        source: 'timer',
        payload: {
          serviceName: service.name,
          githubOwner: service.githubOwner,
          githubRepo: service.githubRepo,
          tracebackUrl: service.tracebackUrl,
          tracebackContent: tracebackContent.slice(0, 4000),
          notifyChatId: service.notifyChatId,
        },
      }));
      return;
    }

    writeTrigger({
      context: `TracebackMonitor: ${service.name} (${service.githubOwner}/${service.githubRepo})`,
      error_log: tracebackContent.slice(0, 4000), // Limit to 4KB for trigger
      service_name: service.name,
      traceback_url: service.tracebackUrl,
      source: 'traceback-monitor',
      timestamp: new Date().toISOString(),
      metadata: {
        github_owner: service.githubOwner,
        github_repo: service.githubRepo,
        notify_chat_id: service.notifyChatId,
      },
    });

    invokeClaudeSkill({ skill: 'auto-repair' }).catch((err) => {
      log.error('monitor', `Auto-repair invocation failed for ${service.name}`, {
        error: String(err),
      });
    });
  }
}
