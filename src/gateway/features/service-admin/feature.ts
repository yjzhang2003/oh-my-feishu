import {
  addService,
  getService,
  listServices,
  removeService,
  updateService,
  type ServiceEntry,
} from '../../../service/registry.js';
import { cloneServiceRepository, removeServiceRepository } from '../../../service/repository.js';
import type { GatewayEvent, GatewayFeature } from '../types.js';

type ServiceAdminAction = 'add' | 'remove' | 'list' | 'get' | 'update' | 'enable' | 'disable' | 'help';

interface ServiceAdminPayload {
  action: ServiceAdminAction;
  name?: string;
  repo?: string;
  tracebackUrl?: string;
  notifyChatId?: string;
  addedBy?: string;
  pollIntervalSec?: number;
  autoPr?: boolean;
  prBaseBranch?: string;
  prDraft?: boolean;
  prBranchPrefix?: string;
  requireConfirmation?: boolean;
}

export const serviceAdminFeature: GatewayFeature = {
  name: 'service-admin',
  triggers: [{ type: 'service.command', source: 'feishu' }],

  async handle(event: GatewayEvent) {
    const payload = parsePayload(event.payload);

    switch (payload.action) {
      case 'add':
        return handleAdd(payload);
      case 'remove':
        return handleRemove(payload);
      case 'list':
        return handleList();
      case 'get':
        return handleGet(payload);
      case 'update':
        return handleUpdate(payload);
      case 'enable':
      case 'disable':
        return handleToggle(payload.action, payload);
      case 'help':
      default:
        return {
          success: true,
          data: {
            title: 'Service Commands',
            elements: [
              '`/service add <name> <owner/repo> <traceback_url>`',
              '`/service remove <name>`',
              '`/service list`',
              '`/service get <name>`',
              '`/service update <name> [repo] [traceback_url]`',
              '`/service enable <name>`',
              '`/service disable <name>`',
            ],
          },
        };
    }
  },
};

async function handleAdd(payload: ServiceAdminPayload) {
  if (!payload.name || !payload.repo || !payload.tracebackUrl) {
    return {
      success: false,
      data: {
        title: 'Invalid /service add',
        elements: ['Usage: `/service add <name> <owner/repo> <traceback_url>`'],
      },
    };
  }

  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(payload.repo)) {
    return {
      success: false,
      data: {
        title: 'Invalid repo format',
        elements: ['Repo must be in `owner/repo` format (e.g. `myorg/my-api`)'],
      },
    };
  }

  if (!/^https?:\/\/.+/.test(payload.tracebackUrl)) {
    return {
      success: false,
      data: {
        title: 'Invalid URL',
        elements: ['Traceback URL must start with `http://` or `https://`'],
      },
    };
  }

  const [githubOwner, githubRepo] = payload.repo.split('/');

  try {
    if (getService(payload.name)) {
      throw new Error(`Service "${payload.name}" already exists`);
    }

    const localRepoPath = await cloneServiceRepository({
      serviceName: payload.name,
      owner: githubOwner,
      repo: githubRepo,
    });

    addService({
      name: payload.name,
      githubOwner,
      githubRepo,
      localRepoPath,
      tracebackUrl: payload.tracebackUrl,
      notifyChatId: payload.notifyChatId || '',
      tracebackUrlType: 'json',
      enabled: true,
      addedAt: new Date().toISOString(),
      addedBy: payload.addedBy || 'unknown',
      autoPr: payload.autoPr ?? false,
      prBaseBranch: payload.prBaseBranch || 'main',
      prDraft: payload.prDraft ?? true,
      prBranchPrefix: payload.prBranchPrefix || 'oh-my-feishu/web-monitor',
      requireConfirmation: payload.requireConfirmation ?? false,
    });

    const prConfig = formatPrConfig({
      autoPr: payload.autoPr ?? false,
      prBaseBranch: payload.prBaseBranch || 'main',
      prDraft: payload.prDraft ?? true,
      prBranchPrefix: payload.prBranchPrefix || 'oh-my-feishu/web-monitor',
    });

    return {
      success: true,
      data: {
        title: 'Service Registered',
        elements: [
          `**Name:** ${payload.name}`,
          `**Repo:** ${payload.repo}`,
          `**Local:** ${localRepoPath}`,
          `**Traceback URL:** ${payload.tracebackUrl}`,
          `**Notify chat:** ${payload.notifyChatId || '(none)'}`,
          `**Auto PR:** ${prConfig}`,
          '',
          'TracebackMonitor will poll this service for new errors.',
        ],
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: {
        title: 'Failed to add service',
        elements: [error instanceof Error ? error.message : 'Unknown error'],
      },
    };
  }
}

function handleRemove(payload: ServiceAdminPayload) {
  if (!payload.name) {
    return {
      success: false,
      data: {
        title: 'Invalid /service remove',
        elements: ['Usage: `/service remove <name>`'],
      },
    };
  }

  const existing = getService(payload.name);
  const removed = removeService(payload.name);
  if (removed && existing?.localRepoPath) {
    removeServiceRepository(payload.name);
  }
  return {
    success: removed,
    data: {
      title: removed ? 'Service Removed' : 'Service Not Found',
      elements: [removed ? `Service "${payload.name}" has been removed.` : `Service "${payload.name}" is not registered.`],
    },
  };
}

function handleList() {
  const services = listServices();
  if (services.length === 0) {
    return {
      success: true,
      data: {
        title: 'Service Registry',
        elements: ['No services registered. Use `/service add` to register one.'],
      },
    };
  }

  return {
    success: true,
    data: {
      title: `Service Registry (${services.length})`,
      elements: services.map(formatServiceLine),
    },
  };
}

function handleGet(payload: ServiceAdminPayload) {
  if (!payload.name) {
    return {
      success: false,
      data: {
        title: 'Invalid /service get',
        elements: ['Usage: `/service get <name>`'],
      },
    };
  }

  const service = getService(payload.name);
  if (!service) {
    return {
      success: false,
      data: {
        title: 'Service Not Found',
        elements: [`Service "${payload.name}" is not registered.`],
      },
    };
  }

  return {
    success: true,
    data: {
      title: `Service ${service.name}`,
      service,
      elements: [
        `**Name:** ${service.name}`,
        `**Repo:** ${service.githubOwner}/${service.githubRepo}`,
        `**Local:** ${service.localRepoPath || '(none)'}`,
        `**Traceback URL:** ${service.tracebackUrl}`,
        `**Notify chat:** ${service.notifyChatId || '(none)'}`,
        `**Enabled:** ${service.enabled}`,
        `**Poll interval:** ${service.pollIntervalSec || 60}s`,
        `**Auto PR:** ${formatPrConfig(service)}`,
        `**Last checked:** ${service.lastCheckedAt || '(never)'}`,
      ],
    },
  };
}

function handleUpdate(payload: ServiceAdminPayload) {
  if (!payload.name) {
    return {
      success: false,
      data: {
        title: 'Invalid /service update',
        elements: ['Usage: `/service update <name> [repo] [traceback_url]`'],
      },
    };
  }

  const updates: Partial<ServiceEntry> = {};

  if (payload.repo) {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(payload.repo)) {
      return {
        success: false,
        data: {
          title: 'Invalid repo format',
          elements: ['Repo must be in `owner/repo` format (e.g. `myorg/my-api`)'],
        },
      };
    }
    const [githubOwner, githubRepo] = payload.repo.split('/');
    updates.githubOwner = githubOwner;
    updates.githubRepo = githubRepo;
  }

  if (payload.tracebackUrl) {
    if (!/^https?:\/\/.+/.test(payload.tracebackUrl)) {
      return {
        success: false,
        data: {
          title: 'Invalid URL',
          elements: ['Traceback URL must start with `http://` or `https://`'],
        },
      };
    }
    updates.tracebackUrl = payload.tracebackUrl;
    updates.lastErrorHash = undefined;
    updates.lastCheckedAt = undefined;
    updates.lastTracebackAt = undefined;
    updates.lastTracebackPreview = undefined;
  }

  if (payload.notifyChatId !== undefined) {
    updates.notifyChatId = payload.notifyChatId;
  }

  if (payload.pollIntervalSec !== undefined) {
    if (!Number.isInteger(payload.pollIntervalSec) || payload.pollIntervalSec < 10) {
      return {
        success: false,
        data: {
          title: 'Invalid poll interval',
          elements: ['Poll interval must be an integer >= 10 seconds.'],
        },
      };
    }
    updates.pollIntervalSec = payload.pollIntervalSec;
  }

  if (payload.autoPr !== undefined) {
    updates.autoPr = payload.autoPr;
  }

  if (payload.prBaseBranch !== undefined) {
    updates.prBaseBranch = payload.prBaseBranch || 'main';
  }

  if (payload.prDraft !== undefined) {
    updates.prDraft = payload.prDraft;
  }

  if (payload.prBranchPrefix !== undefined) {
    updates.prBranchPrefix = payload.prBranchPrefix || 'oh-my-feishu/web-monitor';
  }

  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      data: {
        title: 'No updates provided',
        elements: ['Provide at least one of: repo, tracebackUrl, notifyChatId, pollIntervalSec, autoPr, prBaseBranch, prDraft, prBranchPrefix.'],
      },
    };
  }

  const updated = updateService(payload.name, updates);
  if (!updated) {
    return {
      success: false,
      data: {
        title: 'Service Not Found',
        elements: [`Service "${payload.name}" is not registered.`],
      },
    };
  }

  return {
    success: true,
    data: {
      title: 'Service Updated',
      service: updated,
      elements: [
        `Service "${payload.name}" has been updated.`,
        `Changed fields: ${Object.keys(updates).join(', ')}`,
      ],
    },
  };
}

function handleToggle(action: 'enable' | 'disable', payload: ServiceAdminPayload) {
  if (!payload.name) {
    return {
      success: false,
      data: {
        title: `Invalid /service ${action}`,
        elements: [`Usage: \`/service ${action} <name>\``],
      },
    };
  }

  const updated = updateService(payload.name, { enabled: action === 'enable' });
  if (!updated) {
    return {
      success: false,
      data: {
        title: 'Service Not Found',
        elements: [`Service "${payload.name}" is not registered.`],
      },
    };
  }

  return {
    success: true,
    data: {
      title: `Service ${action === 'enable' ? 'Enabled' : 'Disabled'}`,
      elements: [`Service "${payload.name}" is now ${action === 'enable' ? 'enabled' : 'disabled'}.`],
    },
  };
}

function formatServiceLine(service: ServiceEntry): string {
  return `- **${service.name}** \`${service.githubOwner}/${service.githubRepo}\` ${service.enabled ? '🟢' : '🔴'} ${service.autoPr ? 'auto-pr' : 'local-fix'} ${service.lastCheckedAt ? `last: ${service.lastCheckedAt}` : ''}`;
}

function formatPrConfig(service: Pick<ServiceEntry, 'autoPr' | 'prBaseBranch' | 'prDraft' | 'prBranchPrefix'>): string {
  if (!service.autoPr) {
    return 'disabled';
  }
  return `enabled · base=${service.prBaseBranch || 'main'} · ${service.prDraft === false ? 'ready' : 'draft'} · branch=${service.prBranchPrefix || 'oh-my-feishu/web-monitor'}/*`;
}

function parsePayload(payload: unknown): ServiceAdminPayload {
  if (!payload || typeof payload !== 'object') {
    return { action: 'help' };
  }

  const value = payload as Partial<ServiceAdminPayload>;
  return {
    action: value.action || 'help',
    name: value.name,
    repo: value.repo,
    tracebackUrl: value.tracebackUrl,
    notifyChatId: value.notifyChatId,
    addedBy: value.addedBy,
    pollIntervalSec: value.pollIntervalSec,
    autoPr: value.autoPr,
    prBaseBranch: value.prBaseBranch,
    prDraft: value.prDraft,
    prBranchPrefix: value.prBranchPrefix,
    requireConfirmation: value.requireConfirmation,
  };
}
