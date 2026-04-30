import type { InvokeResult } from '../../trigger/invoker.js';

export type GatewayEventSource = 'feishu' | 'timer' | 'webhook' | 'cli' | 'internal';

export interface GatewayEvent {
  id: string;
  type: string;
  source: GatewayEventSource;
  feature?: string;
  chatId?: string;
  senderOpenId?: string;
  messageId?: string;
  payload: unknown;
  createdAt: string;
}

export interface GatewayTrigger {
  type: string;
  source?: GatewayEventSource;
}

export interface ClaudeTaskInput {
  feature: string;
  instruction: string;
  context?: Record<string, unknown>;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface GatewayResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  claude?: InvokeResult;
}

export interface FeishuSendInput {
  chatId: string;
  content: string;
}

export interface GatewayLogger {
  debug(category: string, message: string, data?: Record<string, unknown>): void;
  info(category: string, message: string, data?: Record<string, unknown>): void;
  warn(category: string, message: string, data?: Record<string, unknown>): void;
  error(category: string, message: string, data?: Record<string, unknown>): void;
}

export interface GatewayRuntime {
  invokeMainClaude(input: ClaudeTaskInput): Promise<InvokeResult>;
  sendFeishuMessage(input: FeishuSendInput): Promise<void>;
  log: GatewayLogger;
}

export interface GatewayFeature {
  name: string;
  triggers: GatewayTrigger[];
  handle(event: GatewayEvent, runtime: GatewayRuntime): Promise<GatewayResult>;
}
