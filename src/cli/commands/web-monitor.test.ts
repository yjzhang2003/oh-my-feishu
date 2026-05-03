import { describe, expect, it } from 'vitest';
import { buildServiceAdminPayload, parseWebMonitorArgs } from './web-monitor.js';

describe('web-monitor CLI command parsing', () => {
  it('builds add payload for service-admin Gateway feature', () => {
    const opts = parseWebMonitorArgs([
      'add',
      'api',
      'org/api',
      'https://logs.example.com/api',
      '--chat-id',
      'oc_test',
    ]);

    expect(buildServiceAdminPayload(opts)).toEqual({
      action: 'add',
      name: 'api',
      repo: 'org/api',
      tracebackUrl: 'https://logs.example.com/api',
      notifyChatId: 'oc_test',
      addedBy: 'workspace-claude',
      autoPr: false,
      prBaseBranch: 'main',
      prDraft: true,
      prBranchPrefix: 'oh-my-feishu/web-monitor',
    });
  });

  it('builds update payload with optional fields', () => {
    const opts = parseWebMonitorArgs([
      'update',
      'api',
      '--repo',
      'new-org/new-api',
      '--traceback-url',
      'https://logs.example.com/new-api',
      '--chat-id',
      '',
      '--interval',
      '120',
      '--auto-pr',
      '--pr-base',
      'release',
      '--pr-ready',
      '--pr-branch-prefix',
      'bot/fix',
    ]);

    expect(buildServiceAdminPayload(opts)).toEqual({
      action: 'update',
      name: 'api',
      repo: 'new-org/new-api',
      tracebackUrl: 'https://logs.example.com/new-api',
      notifyChatId: '',
      pollIntervalSec: 120,
      autoPr: true,
      prBaseBranch: 'release',
      prDraft: false,
      prBranchPrefix: 'bot/fix',
    });
  });

  it('builds simple action payloads', () => {
    expect(buildServiceAdminPayload(parseWebMonitorArgs(['list']))).toEqual({ action: 'list' });
    expect(buildServiceAdminPayload(parseWebMonitorArgs(['get', 'api']))).toEqual({ action: 'get', name: 'api' });
    expect(buildServiceAdminPayload(parseWebMonitorArgs(['remove', 'api']))).toEqual({ action: 'remove', name: 'api' });
    expect(buildServiceAdminPayload(parseWebMonitorArgs(['enable', 'api']))).toEqual({ action: 'enable', name: 'api' });
    expect(buildServiceAdminPayload(parseWebMonitorArgs(['disable', 'api']))).toEqual({ action: 'disable', name: 'api' });
  });
});
