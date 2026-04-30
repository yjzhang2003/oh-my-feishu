import {
  addService,
  listServices,
  removeService,
  updateService,
  type ServiceEntry,
} from '../../../service/registry.js';
import type { GatewayEvent, GatewayFeature } from '../types.js';

type ServiceAdminAction = 'add' | 'remove' | 'list' | 'enable' | 'disable' | 'help';

interface ServiceAdminPayload {
  action: ServiceAdminAction;
  name?: string;
  repo?: string;
  tracebackUrl?: string;
  notifyChatId?: string;
  addedBy?: string;
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
              '`/service enable <name>`',
              '`/service disable <name>`',
            ],
          },
        };
    }
  },
};

function handleAdd(payload: ServiceAdminPayload) {
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
    addService({
      name: payload.name,
      githubOwner,
      githubRepo,
      tracebackUrl: payload.tracebackUrl,
      notifyChatId: payload.notifyChatId || '',
      tracebackUrlType: 'json',
      enabled: true,
      addedAt: new Date().toISOString(),
      addedBy: payload.addedBy || 'unknown',
    });

    return {
      success: true,
      data: {
        title: 'Service Registered',
        elements: [
          `**Name:** ${payload.name}`,
          `**Repo:** ${payload.repo}`,
          `**Traceback URL:** ${payload.tracebackUrl}`,
          `**Notify chat:** ${payload.notifyChatId || '(none)'}`,
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

  const removed = removeService(payload.name);
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
  return `- **${service.name}** \`${service.githubOwner}/${service.githubRepo}\` ${service.enabled ? '🟢' : '🔴'} ${service.lastCheckedAt ? `last: ${service.lastCheckedAt}` : ''}`;
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
  };
}
