import {
  hashContent,
  listEnabledServices,
  updateServiceClaudeRun,
  updateServiceErrorHash,
  updateServiceTracebackSnapshot,
  type ServiceEntry,
  type ClaudeRunResult,
} from '../../../service/registry.js';

export type WebMonitorService = ServiceEntry;

export function listEnabledWebMonitorServices(): WebMonitorService[] {
  return listEnabledServices();
}

export function updateWebMonitorServiceHash(name: string, hash: string, checkedAt: string): void {
  updateServiceErrorHash(name, hash, checkedAt);
}

export function updateWebMonitorTracebackSnapshot(name: string, preview: string, checkedAt: string): void {
  updateServiceTracebackSnapshot(name, preview, checkedAt);
}

export function updateWebMonitorClaudeRun(
  name: string,
  input: { success: boolean; result: ClaudeRunResult; finishedAt: string }
): void {
  updateServiceClaudeRun(name, input);
}

export function hashTracebackContent(content: string): string {
  return hashContent(content);
}
