import {
  hashContent,
  listEnabledServices,
  updateServiceErrorHash,
  type ServiceEntry,
} from '../../../service/registry.js';

export type WebMonitorService = ServiceEntry;

export function listEnabledWebMonitorServices(): WebMonitorService[] {
  return listEnabledServices();
}

export function updateWebMonitorServiceHash(name: string, hash: string, checkedAt: string): void {
  updateServiceErrorHash(name, hash, checkedAt);
}

export function hashTracebackContent(content: string): string {
  return hashContent(content);
}
