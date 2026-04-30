import { webMonitorFeature } from './web-monitor/feature.js';
import { GatewayFeatureRegistry } from './registry.js';

export function createDefaultGatewayFeatureRegistry(): GatewayFeatureRegistry {
  const registry = new GatewayFeatureRegistry();
  registry.register(webMonitorFeature);
  return registry;
}
