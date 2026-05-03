import chalk from 'chalk';
import { GatewaySocketClient } from '../socket-client.js';

export type WebMonitorCommandAction =
  | 'list'
  | 'get'
  | 'add'
  | 'remove'
  | 'enable'
  | 'disable'
  | 'update';

export interface WebMonitorCommandOptions {
  action?: WebMonitorCommandAction;
  name?: string;
  repo?: string;
  tracebackUrl?: string;
  chatId?: string;
  interval?: number;
}

export function parseWebMonitorArgs(args: string[]): WebMonitorCommandOptions {
  const action = args[0] as WebMonitorCommandAction | undefined;
  const opts: WebMonitorCommandOptions = { action };

  switch (action) {
    case 'add':
      opts.name = args[1];
      opts.repo = args[2];
      opts.tracebackUrl = args[3];
      parseFlags(args.slice(4), opts);
      return opts;
    case 'update':
      opts.name = args[1];
      parseFlags(args.slice(2), opts);
      return opts;
    case 'get':
    case 'remove':
    case 'enable':
    case 'disable':
      opts.name = args[1];
      return opts;
    case 'list':
    default:
      return opts;
  }
}

export function buildServiceAdminPayload(opts: WebMonitorCommandOptions): Record<string, unknown> {
  switch (opts.action) {
    case 'list':
      return { action: 'list' };
    case 'get':
      return { action: 'get', name: opts.name };
    case 'remove':
      return { action: 'remove', name: opts.name };
    case 'enable':
      return { action: 'enable', name: opts.name };
    case 'disable':
      return { action: 'disable', name: opts.name };
    case 'add':
      return {
        action: 'add',
        name: opts.name,
        repo: opts.repo,
        tracebackUrl: opts.tracebackUrl,
        notifyChatId: opts.chatId || '',
        addedBy: 'workspace-claude',
      };
    case 'update':
      return {
        action: 'update',
        name: opts.name,
        ...(opts.repo ? { repo: opts.repo } : {}),
        ...(opts.tracebackUrl ? { tracebackUrl: opts.tracebackUrl } : {}),
        ...(opts.chatId !== undefined ? { notifyChatId: opts.chatId } : {}),
        ...(opts.interval !== undefined ? { pollIntervalSec: opts.interval } : {}),
      };
    default:
      return { action: 'help' };
  }
}

export async function handleWebMonitorCommand(opts: WebMonitorCommandOptions): Promise<void> {
  if (!opts.action || !isValidAction(opts.action)) {
    printWebMonitorHelp();
    return;
  }

  if (requiresName(opts.action) && !opts.name) {
    printWebMonitorHelp();
    return;
  }

  if (opts.action === 'add' && (!opts.repo || !opts.tracebackUrl)) {
    printWebMonitorHelp();
    return;
  }

  const response = await requestGateway((client) => {
    client.triggerGatewayFeature({
      feature: 'service-admin',
      eventType: 'service.command',
      payload: buildServiceAdminPayload(opts),
    });
  });
  if (!response) return;

  const parsed = parseResponse(response.content);
  if (!parsed.success) {
    console.log(chalk.red(formatGatewayResult(parsed)));
    return;
  }

  console.log(formatGatewayResult(parsed));
}

function parseFlags(args: string[], opts: WebMonitorCommandOptions): void {
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    const value = args[i + 1];
    if (!flag?.startsWith('--')) continue;

    if (flag === '--repo') {
      opts.repo = value;
      i += 1;
    } else if (flag === '--traceback-url') {
      opts.tracebackUrl = value;
      i += 1;
    } else if (flag === '--chat-id') {
      opts.chatId = value ?? '';
      i += 1;
    } else if (flag === '--interval') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) opts.interval = parsed;
      i += 1;
    }
  }
}

function requestGateway(
  send: (client: GatewaySocketClient) => void
): Promise<{ content?: string } | null> {
  const client = new GatewaySocketClient();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log(chalk.red('Gateway request timed out'));
      client.disconnect();
      resolve(null);
    }, 30000);

    client.connect((message) => {
      if (message.type !== 'gateway:trigger') return;
      clearTimeout(timer);
      client.disconnect();
      resolve({ content: message.content });
    }).then(() => {
      send(client);
    }).catch((error) => {
      clearTimeout(timer);
      console.log(chalk.red(`Failed to connect to Gateway: ${error instanceof Error ? error.message : String(error)}`));
      resolve(null);
    });
  });
}

function parseResponse(content: string | undefined): Record<string, any> {
  if (!content) return { success: false, error: 'empty response' };
  try {
    return JSON.parse(content);
  } catch {
    return { success: false, error: content };
  }
}

function formatGatewayResult(result: Record<string, any>): string {
  const data = result.data ?? {};
  const lines = Array.isArray(data.elements) ? data.elements : [];
  if (lines.length > 0) {
    return [data.title, ...lines].filter(Boolean).join('\n');
  }
  if (result.message) return String(result.message);
  return JSON.stringify(result, null, 2);
}

function isValidAction(action: string): action is WebMonitorCommandAction {
  return ['list', 'get', 'add', 'remove', 'enable', 'disable', 'update'].includes(action);
}

function requiresName(action: WebMonitorCommandAction): boolean {
  return ['get', 'remove', 'enable', 'disable', 'update'].includes(action);
}

function printWebMonitorHelp(): void {
  console.log(`
${chalk.bold('Web Monitor commands')}

${chalk.bold('Usage:')}
  oh-my-feishu web-monitor list
  oh-my-feishu web-monitor get <name>
  oh-my-feishu web-monitor add <name> <owner/repo> <traceback_url> [--chat-id <chat_id>]
  oh-my-feishu web-monitor remove <name>
  oh-my-feishu web-monitor enable <name>
  oh-my-feishu web-monitor disable <name>
  oh-my-feishu web-monitor update <name> [--repo <owner/repo>] [--traceback-url <url>] [--chat-id <chat_id>] [--interval <seconds>]

${chalk.bold('Examples:')}
  oh-my-feishu web-monitor list
  oh-my-feishu web-monitor add api myorg/api https://logs.example.com/api
  oh-my-feishu web-monitor update api --traceback-url https://logs.example.com/new-api --interval 60
`);
}
