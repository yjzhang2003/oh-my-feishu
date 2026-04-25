#!/usr/bin/env tsx
/**
 * Feishu Agent - Main entry point
 * Starts WebSocket connection for direct Feishu ↔ Claude Code chat
 */

import { FeishuWebSocket, loadLarkCliConfig } from './feishu/websocket-connector.js';
import { checkLarkConfig } from './feishu/lark-auth.js';
import { checkClaudeCli } from './trigger/invoker.js';
import { env } from './config/env.js';

function keepAlive(): void {
  // Keep the process alive with a no-op interval
  setInterval(() => {}, 24 * 60 * 60 * 1000); // 24 hours
}

async function main() {
  console.log('🚀 Starting Feishu Agent...\n');

  // Check Claude CLI
  const claudeStatus = await checkClaudeCli();
  if (!claudeStatus.available) {
    console.error('❌ Claude CLI not available. Please install it first:');
    console.error('   npm install -g @anthropic-ai/claude-code\n');
    console.error('Waiting for configuration... (service will auto-connect when ready)');
    console.error('Run "npm run cli" to configure, then restart this service.\n');
    keepAlive();
    return;
  }
  console.log(`✅ Claude CLI: ${claudeStatus.version}`);

  // Check lark-cli config
  const larkStatus = await checkLarkConfig();
  if (!larkStatus.configured) {
    console.error('❌ lark-cli not configured. Please run:');
    console.error('   lark-cli config init --new\n');
    console.error('Waiting for configuration... (service will auto-connect when ready)');
    console.error('Run "npm run cli" to configure, then restart this service.\n');
    keepAlive();
    return;
  }
  console.log(`✅ Lark CLI: ${larkStatus.appId?.slice(0, 8)}... (${larkStatus.brand})`);

  // Check GitHub token (optional)
  if (env.GITHUB_TOKEN) {
    console.log('✅ GitHub: Configured');
  } else {
    console.log('⚠️  GitHub: Not configured (auto-repair will not work)');
  }

  console.log('\n📡 Connecting to Feishu via WebSocket...\n');

  // Load config and start WebSocket
  const config = await loadLarkCliConfig();
  if (!config) {
    console.error('❌ Failed to load lark-cli config');
    console.error('Waiting for configuration... (service will auto-connect when ready)');
    console.error('Run "npm run cli" to configure, then restart this service.\n');
    keepAlive();
    return;
  }

  const ws = new FeishuWebSocket(config);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n\n🛑 Shutting down...');
    await ws.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await ws.connect();
    console.log('✅ WebSocket connected successfully!');
    console.log('\n💬 Send a message in Feishu to start chatting with Claude Code.');
    console.log('   Commands: /repair, /status, /help\n');
    console.log('Press Ctrl+C to stop.\n');
  } catch (error) {
    console.error('❌ Failed to connect:', error);
    // Stay running to allow manual intervention
  }
}

main();
