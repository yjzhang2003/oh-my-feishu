import { randomUUID } from 'crypto';
import { log } from '../../utils/logger.js';
import { GatewayFeatureRegistry } from './registry.js';
import type { GatewayEvent, GatewayResult, GatewayRuntime } from './types.js';

export interface GatewayFeatureRunnerOptions {
  registry: GatewayFeatureRegistry;
  runtime: GatewayRuntime;
}

export class GatewayFeatureRunner {
  constructor(private options: GatewayFeatureRunnerOptions) {}

  listFeatures(): Array<{ name: string; triggers: GatewayEvent['type'][] }> {
    return this.options.registry.list().map((feature) => ({
      name: feature.name,
      triggers: feature.triggers.map((trigger) => trigger.type),
    }));
  }

  async run(event: GatewayEvent): Promise<GatewayResult> {
    const feature = this.options.registry.match(event);
    if (!feature) {
      log.warn('gateway-feature', 'No feature matched event', {
        eventId: event.id,
        eventType: event.type,
        source: event.source,
        feature: event.feature,
      });
      return {
        success: false,
        message: `No Gateway feature matched event "${event.type}"`,
      };
    }

    log.info('gateway-feature', 'Running feature', {
      feature: feature.name,
      eventId: event.id,
      eventType: event.type,
      source: event.source,
    });

    try {
      const result = await feature.handle(event, this.options.runtime);
      log.info('gateway-feature', 'Feature completed', {
        feature: feature.name,
        eventId: event.id,
        success: result.success,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('gateway-feature', 'Feature failed', {
        feature: feature.name,
        eventId: event.id,
        error: message,
      });
      return {
        success: false,
        message,
      };
    }
  }
}

export function createGatewayEvent(input: Omit<GatewayEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
}): GatewayEvent {
  return {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
