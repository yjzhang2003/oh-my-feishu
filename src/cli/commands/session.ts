/**
 * Session Command
 * Manage directory sessions via CLI
 */

import chalk from 'chalk';
import { install } from '../../marketplace/index.js';
import { GatewaySocketClient } from '../socket-client.js';

export interface SessionCommandOptions {
  action: 'new' | 'list' | 'attach' | 'destroy';
  directory?: string;
  chatId?: string;
}

export async function handleSessionCommand(opts: SessionCommandOptions): Promise<void> {
  const client = new GatewaySocketClient();

  switch (opts.action) {
    case 'new':
      if (!opts.directory) {
        console.log(chalk.red('Error: directory required for new session'));
        console.log('Usage: oh-my-feishu session new <directory>');
        return;
      }
      await handleNewSession(client, opts.directory);
      break;

    case 'list':
      await handleListSessions(client);
      break;

    case 'attach':
      if (!opts.chatId || !opts.directory) {
        console.log(chalk.red('Error: chatId and directory required for attach'));
        console.log('Usage: oh-my-feishu session attach <chatId> <directory>');
        return;
      }
      await handleAttachSession(client, opts.chatId, opts.directory);
      break;

    case 'destroy':
      if (!opts.chatId) {
        console.log(chalk.red('Error: chatId required for destroy'));
        console.log('Usage: oh-my-feishu session destroy <chatId>');
        return;
      }
      await handleDestroySession(client, opts.chatId);
      break;
  }
}

async function handleNewSession(client: GatewaySocketClient, directory: string): Promise<void> {
  console.log(chalk.cyan(`Installing oh-my-feishu plugin to ${directory}...`));

  try {
    await install({ targetDir: directory });
    console.log(chalk.green(`✓ Plugin installed to ${directory}`));
  } catch (err) {
    console.log(chalk.red(`✗ Failed to install plugin: ${err}`));
    return;
  }

  console.log(chalk.cyan('Connecting to Gateway...'));

  try {
    await client.connect((message) => {
      if (message.type === 'message' && message.content) {
        console.log(chalk.blue('[Claude]'), message.content);
      }
    });

    // For new session, we need a chatId - use a placeholder for now
    // The actual chatId will be assigned when user sends first message
    const chatId = `cli-session-${Date.now()}`;
    client.createSession(chatId, directory, 'cli');

    console.log(chalk.green('✓ Session created'));
    console.log(`  Directory: ${directory}`);
    console.log(`  ChatId: ${chatId}`);
    console.log('');
    console.log('Send a message from Feishu to start chatting!');
  } catch (err) {
    console.log(chalk.red(`✗ Failed to connect to Gateway: ${err}`));
    console.log('Make sure the Gateway service is running (npm start or pm2 start).');
  }
}

async function handleListSessions(client: GatewaySocketClient): Promise<void> {
  try {
    await client.connect(() => {});
    client.listSessions();
    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 1000));
    client.disconnect();
  } catch (err) {
    console.log(chalk.red(`✗ Failed to list sessions: ${err}`));
  }
}

async function handleAttachSession(client: GatewaySocketClient, chatId: string, directory: string): Promise<void> {
  try {
    await client.connect((message) => {
      if (message.type === 'message' && message.content) {
        console.log(chalk.blue('[Claude]'), message.content);
      }
    });

    client.createSession(chatId, directory, 'cli');
    console.log(chalk.green(`✓ Attached to session ${chatId}`));
    console.log(`  Directory: ${directory}`);
  } catch (err) {
    console.log(chalk.red(`✗ Failed to attach: ${err}`));
  }
}

async function handleDestroySession(client: GatewaySocketClient, chatId: string): Promise<void> {
  try {
    await client.connect(() => {});
    client.destroySession(chatId);
    console.log(chalk.green(`✓ Session ${chatId} destroyed`));
    client.disconnect();
  } catch (err) {
    console.log(chalk.red(`✗ Failed to destroy session: ${err}`));
  }
}
