import type { GatewayEvent, GatewayFeature, GatewayTrigger } from './types.js';

export class GatewayFeatureRegistry {
  private features = new Map<string, GatewayFeature>();

  register(feature: GatewayFeature): void {
    const existing = this.features.get(feature.name);
    if (existing) {
      throw new Error(`Gateway feature "${feature.name}" is already registered`);
    }
    this.features.set(feature.name, feature);
  }

  get(name: string): GatewayFeature | undefined {
    return this.features.get(name);
  }

  list(): GatewayFeature[] {
    return Array.from(this.features.values());
  }

  match(event: GatewayEvent): GatewayFeature | undefined {
    if (event.feature) {
      return this.features.get(event.feature);
    }

    return this.list().find((feature) =>
      feature.triggers.some((trigger) => matchesTrigger(trigger, event))
    );
  }
}

function matchesTrigger(trigger: GatewayTrigger, event: GatewayEvent): boolean {
  if (trigger.type !== event.type) return false;
  if (trigger.source && trigger.source !== event.source) return false;
  return true;
}
