#!/usr/bin/env node
/**
 * CLI Entry Point
 * Handles both interactive mode and command mode
 */

import { handleSessionCommand, type SessionCommandOptions } from './commands/session.js';
import { handleGatewayCommand, type GatewayCommandOptions } from './commands/gateway.js';
import { handleWebMonitorCommand, parseWebMonitorArgs } from './commands/web-monitor.js';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    await import('./index.js');
    return;
  }

  // Command mode
  if (command === 'session') {
    const action = args[1] as SessionCommandOptions['action'];
    const subArgs = args.slice(2);

    const opts: SessionCommandOptions = {
      action,
    };

    if (action === 'new' && subArgs[0]) {
      opts.directory = subArgs[0];
    } else if (action === 'attach' && subArgs[0] && subArgs[1]) {
      opts.chatId = subArgs[0];
      opts.directory = subArgs[1];
    } else if (action === 'destroy' && subArgs[0]) {
      opts.chatId = subArgs[0];
    }

    await handleSessionCommand(opts);
    return;
  }

  if (command === 'gateway') {
    const action = args[1] as GatewayCommandOptions['action'];
    await handleGatewayCommand({
      action,
      feature: args[2],
      eventType: args[3],
      payloadJson: args[4],
    });
    return;
  }

  if (command === 'web-monitor') {
    await handleWebMonitorCommand(parseWebMonitorArgs(args.slice(1)));
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  console.log(chalk.red(`Unknown command: ${command}`));
  printHelp();
}

function printHelp() {
  console.log(`
${chalk.bold('oh-my-feishu')} - Claude Code on Feishu

${chalk.bold('Usage:')}
  oh-my-feishu [command] [options]

${chalk.bold('Commands:')}
  (interactive)  Launch interactive TUI setup tool
  session new <directory>    Create a new directory session
  session list               List active sessions
  session attach <chatId> <directory>  Attach to an existing session
  session destroy <chatId>  Destroy a session
  gateway list              List Gateway features
  gateway status            Show Gateway status
  gateway trigger <feature> <eventType> [jsonPayload]
  web-monitor list          List Web Monitor services
  web-monitor add <name> <owner/repo> <traceback_url>
  web-monitor update <name> [--traceback-url <url>] [--repo <owner/repo>]
  help                      Show this help message

${chalk.bold('Examples:')}
  oh-my-feishu                    # Launch interactive TUI
  oh-my-feishu session new ./my-project  # Create session for my-project
  oh-my-feishu session list      # List active sessions
  oh-my-feishu gateway list      # List Gateway features
  oh-my-feishu gateway status    # Show Gateway status
  oh-my-feishu web-monitor list  # List monitored services
`);
}

main().catch((err) => {
  console.error(chalk.red(`Error: ${err}`));
  process.exit(1);
});
