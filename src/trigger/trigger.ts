import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { env } from '../config/env.js';

const TRIGGERS_DIR = resolve(env.REPO_ROOT, 'workspace', '.claude', 'triggers');
const TRIGGER_FILE = resolve(TRIGGERS_DIR, 'latest.json');

export interface TriggerData {
  context: string;
  error_log?: string;
  service_name?: string;
  traceback_url?: string;
  source: 'feishu' | 'feishu-chat' | 'monitor' | 'traceback-monitor' | 'manual';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

function ensureTriggersDir(): void {
  if (!existsSync(TRIGGERS_DIR)) {
    mkdirSync(TRIGGERS_DIR, { recursive: true });
  }
}

export function writeTrigger(data: TriggerData): string {
  ensureTriggersDir();

  const trigger: TriggerData = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  };

  writeFileSync(TRIGGER_FILE, JSON.stringify(trigger, null, 2));

  return TRIGGER_FILE;
}

export function readTrigger(): TriggerData | null {
  if (!existsSync(TRIGGER_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(TRIGGER_FILE, 'utf-8');
    return JSON.parse(content) as TriggerData;
  } catch {
    return null;
  }
}
