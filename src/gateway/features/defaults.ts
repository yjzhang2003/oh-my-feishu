import { webMonitorFeature } from './web-monitor/feature.js';
import { serviceAdminFeature } from './service-admin/feature.js';
import { statusFeature } from './status/feature.js';
import { GatewayFeatureRegistry } from './registry.js';

export function createDefaultGatewayFeatureRegistry(): GatewayFeatureRegistry {
  const registry = new GatewayFeatureRegistry();
  registry.register(webMonitorFeature);
  registry.register(serviceAdminFeature);
  registry.register(statusFeature);
  return registry;
}
