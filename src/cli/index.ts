#!/usr/bin/env node
import readline from 'readline';
import chalk from 'chalk';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import {
  getClaudeApiKey,
  setClaudeApiKey,
  resetClaudeApiKey,
  getEccPluginStatus,
  setFeishuCredentials,
  resetFeishuCredentials,
} from '../config/settings.js';
import { execa } from 'execa';

// Simple readline-based CLI without INK
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const components = ['claude', 'feishu', 'github', 'ecc'] as const;
const componentNames = ['Claude Code', 'Feishu', 'GitHub', 'ECC'];

let selectedIndex = 0;

function clearScreen() {
  // Use ANSI escape codes instead of console.clear() for faster rendering
  process.stdout.write('\x1Bc');
}

// Cache statuses to avoid running subprocesses on every keypress
let cachedStatuses: Record<string, ComponentStatus> | null = null;

function getStatuses(): Record<string, ComponentStatus> {
  if (!cachedStatuses) {
    cachedStatuses = getAllStatuses();
  }
  return cachedStatuses;
}

function refreshStatuses() {
  cachedStatuses = getAllStatuses();
}

function renderMain() {
  const statuses = getStatuses();

  clearScreen();

  console.log(chalk.bold.cyan('Feishu Agent Setup'));
  console.log(chalk.dim('='.repeat(30)));
  console.log(chalk.dim('↑↓ navigate | Enter configure | q quit'));
  console.log();

  components.forEach((key, index) => {
    const status = statuses[key];
    const isSelected = index === selectedIndex;
    const icon = status.configured ? chalk.green('✓') : chalk.red('✗');
    const prefix = isSelected ? chalk.cyan('❯ ') : '  ';
    const name = isSelected ? chalk.bold(componentNames[index]) : componentNames[index];

    console.log(`${prefix}${icon} ${name}: ${chalk.dim(status.message)}`);
  });

  console.log();
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function configureClaude() {
  console.log();
  const currentKey = getClaudeApiKey();

  if (currentKey) {
    console.log(chalk.dim(`Status: ${getStatuses().claude.message}`));
    console.log('[r] reconfigure | [x] reset | [c] cancel');
    const action = await prompt('> ');

    if (action === 'r') {
      const key = await prompt('Enter new ANTHROPIC_API_KEY: ');
      if (key) {
        setClaudeApiKey(key);
        console.log(chalk.green('✓ API key updated'));
      }
    } else if (action === 'x') {
      const confirm = await prompt('Reset API key? (y/N): ');
      if (confirm.toLowerCase() === 'y') {
        resetClaudeApiKey();
        console.log(chalk.green('✓ API key removed'));
      }
    }
  } else {
    const key = await prompt('Enter your ANTHROPIC_API_KEY: ');
    if (key) {
      setClaudeApiKey(key);
      console.log(chalk.green('✓ API key saved'));
    }
  }

  await prompt('Press Enter to continue...');
}

async function configureFeishu() {
  console.log();
  const status = getStatuses().feishu;

  if (status.configured) {
    console.log(chalk.dim(`Status: ${status.message}`));
    console.log('[r] reconfigure | [x] reset | [c] cancel');
    const action = await prompt('> ');

    if (action === 'r') {
      const appId = await prompt('FEISHU_APP_ID: ');
      if (appId) {
        const secret = await prompt('FEISHU_APP_SECRET: ');
        if (secret) {
          setFeishuCredentials(appId, secret);
          console.log(chalk.green('✓ Feishu credentials saved'));
        }
      }
    } else if (action === 'x') {
      const confirm = await prompt('Reset Feishu credentials? (y/N): ');
      if (confirm.toLowerCase() === 'y') {
        resetFeishuCredentials();
        console.log(chalk.green('✓ Feishu credentials removed'));
      }
    }
  } else {
    console.log(chalk.dim('Tip: Scan QR with "feishu-agent setup" to auto-create a bot'));
    const appId = await prompt('FEISHU_APP_ID: ');
    if (appId) {
      const secret = await prompt('FEISHU_APP_SECRET: ');
      if (secret) {
        setFeishuCredentials(appId, secret);
        console.log(chalk.green('✓ Feishu credentials saved'));
      }
    }
  }

  await prompt('Press Enter to continue...');
}

async function configureGitHub() {
  console.log();
  const status = getStatuses().github;

  if (status.configured) {
    console.log(chalk.dim(`Status: ${status.message}`));
    console.log('[x] logout | [c] cancel');
    const action = await prompt('> ');

    if (action === 'x') {
      const confirm = await prompt('Logout from GitHub? (y/N): ');
      if (confirm.toLowerCase() === 'y') {
        await execa('gh', ['auth', 'logout', '--hostname', 'github.com']);
        console.log(chalk.green('✓ Logged out'));
      }
    }
  } else {
    console.log('This will open a browser for GitHub OAuth login...');
    const confirm = await prompt('Continue? (Y/n): ');
    if (confirm.toLowerCase() !== 'n') {
      await execa('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
        stdio: 'inherit',
      });
      console.log(chalk.green('✓ GitHub authenticated'));
    }
  }

  await prompt('Press Enter to continue...');
}

async function configureECC() {
  console.log();
  const status = getEccPluginStatus();

  if (status.installed) {
    console.log(chalk.dim(`Status: v${status.version} installed`));
    console.log('[u] update | [c] cancel');
    const action = await prompt('> ');

    if (action === 'u') {
      console.log('Updating...');
      await execa('claude', ['plugins', 'update', 'everything-claude-code@everything-claude-code']);
      console.log(chalk.green('✓ ECC plugin updated'));
    }
  } else {
    console.log('ECC (Everything Claude Code) provides enhanced skills and agents.');
    const confirm = await prompt('Install ECC plugin? (Y/n): ');
    if (confirm.toLowerCase() !== 'n') {
      console.log('Installing...');
      await execa('claude', ['plugins', 'install', 'everything-claude-code@everything-claude-code']);
      console.log(chalk.green('✓ ECC plugin installed'));
    }
  }

  await prompt('Press Enter to continue...');
}

// Set up raw mode for arrow keys
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.resume();
process.stdin.setEncoding('utf8');

let running = true;

process.stdin.on('data', async (key: string) => {
  if (!running) return;

  // Handle Ctrl+C
  if (key === '' || key === 'q') {
    running = false;
    console.log('\nGoodbye!\n');
    process.exit(0);
  }

  // Up arrow
  if (key === '[A' || key === 'k') {
    selectedIndex = (selectedIndex - 1 + components.length) % components.length;
    renderMain();
  }

  // Down arrow
  if (key === '[B' || key === 'j') {
    selectedIndex = (selectedIndex + 1) % components.length;
    renderMain();
  }

  // Enter
  if (key === '\r' || key === '\n') {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    if (selectedIndex === 0) {
      await configureClaude();
    } else if (selectedIndex === 1) {
      await configureFeishu();
    } else if (selectedIndex === 2) {
      await configureGitHub();
    } else if (selectedIndex === 3) {
      await configureECC();
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    refreshStatuses();
    renderMain();
  }
});

// Initial render
renderMain();
