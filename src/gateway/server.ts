import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from '../config/env.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feishu webhook endpoint
app.post('/webhook', async (c) => {
  // Import handlers dynamically to avoid circular dependencies
  const { handleWebhook } = await import('./routes/webhook.js');
  return handleWebhook(c);
});

// Monitor trigger endpoint
app.post('/monitor', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const { error_log, context, api_key } = body as {
    error_log?: string;
    context?: string;
    api_key?: string;
  };

  // Validate API key if configured
  if (env.MONITOR_API_KEY && api_key !== env.MONITOR_API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  if (!error_log) {
    return c.json({ error: 'error_log is required' }, 400);
  }

  // Write trigger and invoke skill
  const { writeTrigger } = await import('../trigger/trigger.js');
  const { invokeClaudeSkill } = await import('../trigger/invoker.js');

  writeTrigger({
    context: context || 'Monitor trigger',
    error_log,
    source: 'monitor',
    timestamp: new Date().toISOString(),
  });

  // Run skill asynchronously
  invokeClaudeSkill({ skill: 'auto-repair' }).catch(console.error);

  return c.json({
    status: 'accepted',
    message: 'Repair triggered',
  });
});

// Manual trigger endpoint (for testing)
app.post('/trigger', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const { context, error_log } = body as {
    context?: string;
    error_log?: string;
  };

  const { writeTrigger } = await import('../trigger/trigger.js');
  const { invokeClaudeSkill } = await import('../trigger/invoker.js');

  writeTrigger({
    context: context || 'Manual trigger',
    error_log: error_log || '',
    source: 'manual',
    timestamp: new Date().toISOString(),
  });

  // Run skill
  const result = await invokeClaudeSkill({ skill: 'auto-repair' });

  return c.json({
    status: result.success ? 'success' : 'failed',
    stdout: result.stdout,
    stderr: result.stderr,
  });
});

// Start server
const port = Number(process.env.PORT) || 8000;

console.log(`🚀 Feishu Agent Gateway running on http://localhost:${port}`);
console.log(`   Health: http://localhost:${port}/health`);
console.log(`   Webhook: http://localhost:${port}/webhook`);
console.log(`   Monitor: http://localhost:${port}/monitor`);

serve({
  fetch: app.fetch,
  port,
});
