import chalk from 'chalk';
import { GatewaySocketClient } from '../socket-client.js';

export interface GatewayCommandOptions {
  action: 'list' | 'trigger';
  feature?: string;
  eventType?: string;
  payloadJson?: string;
}

export async function handleGatewayCommand(opts: GatewayCommandOptions): Promise<void> {
  switch (opts.action) {
    case 'list':
      await handleList();
      return;
    case 'trigger':
      await handleTrigger(opts);
      return;
    default:
      printGatewayHelp();
  }
}

async function handleList(): Promise<void> {
  const response = await requestGateway((client) => client.listGatewayFeatures(), 'gateway:list');
  if (!response) return;

  const parsed = parseResponse(response.content);
  if (!parsed.success) {
    console.log(chalk.red(`Error: ${parsed.error || 'failed to list gateway features'}`));
    return;
  }

  const features = Array.isArray(parsed.features) ? parsed.features : [];
  for (const feature of features) {
    const triggers = Array.isArray(feature.triggers) ? feature.triggers.join(', ') : '';
    console.log(`${chalk.cyan(feature.name)} ${chalk.dim(triggers)}`);
  }
}

async function handleTrigger(opts: GatewayCommandOptions): Promise<void> {
  if (!opts.feature || !opts.eventType) {
    printGatewayHelp();
    return;
  }

  let payload: unknown = {};
  if (opts.payloadJson) {
    try {
      payload = JSON.parse(opts.payloadJson);
    } catch (error) {
      console.log(chalk.red(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
  }

  const response = await requestGateway((client) => {
    client.triggerGatewayFeature({
      feature: opts.feature!,
      eventType: opts.eventType!,
      payload,
    });
  }, 'gateway:trigger');
  if (!response) return;

  const parsed = parseResponse(response.content);
  console.log(JSON.stringify(parsed, null, 2));
}

function requestGateway(
  send: (client: GatewaySocketClient) => void,
  responseType: 'gateway:list' | 'gateway:trigger'
): Promise<{ content?: string } | null> {
  const client = new GatewaySocketClient();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log(chalk.red('Gateway request timed out'));
      client.disconnect();
      resolve(null);
    }, 30000);

    client.connect((message) => {
      if (message.type !== responseType) return;
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

function printGatewayHelp(): void {
  console.log(`
${chalk.bold('Gateway commands')}

${chalk.bold('Usage:')}
  oh-my-feishu gateway list
  oh-my-feishu gateway trigger <feature> <eventType> [jsonPayload]

${chalk.bold('Examples:')}
  oh-my-feishu gateway list
  oh-my-feishu gateway trigger status status.query '{"connected":true}'
`);
}
