#!/usr/bin/env tsx
/**
 * oh-my-feishu - Main entry point
 * Starts WebSocket connection for direct Feishu ↔ Claude Code chat
 */

import { FeishuWebSocket, loadLarkCliConfig } from './feishu/websocket-connector.js';
import { checkLarkConfig } from './feishu/lark-auth.js';
import { checkClaudeCli } from './trigger/invoker.js';
import { env } from './config/env.js';
import { loadRegistry } from './service/registry.js';
import { TracebackMonitor } from './monitor/traceback-monitor.js';
import { install as installMarketplace } from './marketplace/index.js';
import { resolve } from 'path';
import {
  createDefaultGatewayFeatureRegistry,
  createGatewayRuntime,
  GatewayFeatureRunner,
} from './gateway/features/index.js';

function keepAlive(): void {
  // Keep the process alive with a no-op interval
  setInterval(() => {}, 24 * 60 * 60 * 1000); // 24 hours
}

async function main() {
  console.log('🚀 Starting oh-my-feishu...\n');

  // Check Claude CLI
  const claudeStatus = await checkClaudeCli();
  if (!claudeStatus.available) {
    console.error('❌ Claude CLI not available. Please install it first:');
    console.error('   npm install -g @anthropic-ai/claude-code\n');
    console.error('Waiting for configuration... (service will auto-connect when ready)');
    console.error('Run "oh-my-feishu" to configure, then restart this service.\n');
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
    console.error('Run "oh-my-feishu" to configure, then restart this service.\n');
    keepAlive();
    return;
  }
  console.log(`✅ Lark CLI: ${larkStatus.appId?.slice(0, 8)}... (${larkStatus.brand})`);

  // Direct Feishu chats run Claude Code from the repository workspace.
  // Fresh clones do not track workspace/.claude, so initialize the plugin at boot.
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');
  try {
    await installMarketplace({ targetDir: workspaceDir });
    console.log(`✅ Workspace plugin: ${workspaceDir}`);
  } catch (error) {
    console.error('⚠️  Workspace plugin initialization failed:', error);
  }

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
    console.error('Run "oh-my-feishu" to configure, then restart this service.\n');
    keepAlive();
    return;
  }

  const ws = new FeishuWebSocket(config);
  let tracebackMonitor: TracebackMonitor | null = null;

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n\n🛑 Shutting down...');
    if (tracebackMonitor) {
      tracebackMonitor.stop();
    }
    await ws.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await ws.connect();
    console.log('✅ WebSocket connected successfully!');

    // Start traceback monitor if services are registered.
    const registry = loadRegistry();
    const enabledServices = registry.services.filter(s => s.enabled);
    if (enabledServices.length > 0) {
      const gatewayFeatureRunner = new GatewayFeatureRunner({
        registry: createDefaultGatewayFeatureRegistry(),
        runtime: createGatewayRuntime({
          sendTextMessage: (chatId, text) => ws.sendTextMessage(chatId, text),
        }),
      });
      tracebackMonitor = new TracebackMonitor({ gatewayRunner: gatewayFeatureRunner });
      tracebackMonitor.start().catch((err) => {
        console.error('⚠️  TracebackMonitor failed to start:', err);
        tracebackMonitor = null;
      });
      console.log(`✅ TracebackMonitor: Monitoring ${enabledServices.length} service(s) via Gateway features`);
    }

    // Create bot menu
    try {
      await ws.createBotMenu();
      console.log('✅ Bot menu created');
    } catch (menuError) {
      console.log('⚠️ Bot menu creation failed (may need permissions):', menuError);
    }

    console.log('\n💬 Send a message in Feishu to start chatting with Claude Code.');
    console.log('   Commands: /repair, /service, /status, /help\n');
    console.log('Press Ctrl+C to stop.\n');
  } catch (error) {
    console.error('❌ Failed to connect:', error);
    // Stay running to allow manual intervention
  }
}

main();
