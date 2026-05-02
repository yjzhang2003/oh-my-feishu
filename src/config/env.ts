import { z } from 'zod';
import { getRepoRoot } from './paths.js';

// Environment schema
const envSchema = z.object({
  // GitHub
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO_OWNER: z.string().optional(),
  GITHUB_REPO_NAME: z.string().optional(),

  // Monitor
  MONITOR_API_KEY: z.string().optional(),
  MONITOR_TARGET_URL: z.string().optional(),
  MONITOR_INTERVAL_SEC: z.string().default('60'),
  MONITOR_TIMEOUT_MS: z.string().default('5000'),

  // Agent
  REPO_ROOT: z.string().default(getRepoRoot()),
  AGENT_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AGENT_MAX_DIFF_FILES: z.string().default('10'),
  AGENT_MAX_DIFF_LINES: z.string().default('500'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.warn('Environment validation warnings:', result.error.issues);
  }
  return result.success ? result.data : envSchema.parse({});
}

export const env = loadEnv();
