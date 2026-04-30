import { createGatewayEvent, type GatewayFeatureRunner } from '../runner.js';
import type { WebMonitorService } from './registry.js';

export const MAX_TRACEBACK_CONTEXT_SIZE = 4000;

export function createTracebackDetectedEvent(input: {
  service: WebMonitorService;
  tracebackContent: string;
  previousHash?: string;
  currentHash?: string;
}) {
  const { service, tracebackContent, previousHash, currentHash } = input;

  return createGatewayEvent({
    type: 'traceback.detected',
    source: 'timer',
    payload: {
      serviceName: service.name,
      githubOwner: service.githubOwner,
      githubRepo: service.githubRepo,
      tracebackUrl: service.tracebackUrl,
      tracebackContent: tracebackContent.slice(0, MAX_TRACEBACK_CONTEXT_SIZE),
      notifyChatId: service.notifyChatId,
      previousHash,
      currentHash,
    },
  });
}

export async function dispatchTracebackDetected(
  runner: GatewayFeatureRunner,
  input: Parameters<typeof createTracebackDetectedEvent>[0]
) {
  return runner.run(createTracebackDetectedEvent(input));
}
