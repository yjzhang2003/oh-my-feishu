import type { GatewayEvent, GatewayFeature, GatewayRuntime } from '../types.js';
import {
  createWebMonitorResultCard,
  createTracebackDetectedCard,
  formatWebMonitorResultMessage,
} from './cards.js';
import { updateWebMonitorClaudeRun } from './registry.js';
import { buildWebMonitorClaudeTask } from './service-actions.js';

export interface TracebackDetectedPayload {
  serviceName: string;
  githubOwner: string;
  githubRepo: string;
  localRepoPath?: string;
  tracebackUrl: string;
  tracebackContent: string;
  notifyChatId?: string;
  autoPr?: boolean;
  prBaseBranch?: string;
  prDraft?: boolean;
  prBranchPrefix?: string;
  requireConfirmation?: boolean;
  previousHash?: string;
  currentHash?: string;
}

export interface PendingRepair {
  eventId: string;
  payload: TracebackDetectedPayload;
  createdAt: string;
  analyzing?: boolean;
}

const pendingRepairs = new Map<string, PendingRepair>();

export function getPendingRepair(serviceName: string): PendingRepair | undefined {
  return pendingRepairs.get(serviceName);
}

export function setPendingRepair(serviceName: string, repair: PendingRepair): void {
  pendingRepairs.set(serviceName, repair);
}

export function removePendingRepair(serviceName: string): boolean {
  return pendingRepairs.delete(serviceName);
}

export const webMonitorFeature: GatewayFeature = {
  name: 'web-monitor',
  triggers: [
    { type: 'traceback.detected', source: 'timer' },
    { type: 'traceback.detected', source: 'webhook' },
    { type: 'traceback.detected', source: 'internal' },
  ],

  async handle(event: GatewayEvent, runtime: GatewayRuntime) {
    if (event.type !== 'traceback.detected') {
      return {
        success: false,
        message: `Unsupported web-monitor event: ${event.type}`,
      };
    }

    const payload = parseTracebackPayload(event.payload);
    runtime.log.info('web-monitor', 'Handling traceback event', {
      eventId: event.id,
      serviceName: payload.serviceName,
      requireConfirmation: payload.requireConfirmation,
    });

    if (payload.requireConfirmation && payload.notifyChatId) {
      return await handleConfirmationFlow(event, payload, runtime);
    }

    return await handleAutoRepair(event, payload, runtime);
  },
};

async function handleConfirmationFlow(
  event: GatewayEvent,
  payload: TracebackDetectedPayload,
  runtime: GatewayRuntime
): Promise<{ success: boolean; message: string }> {
  if (!payload.notifyChatId) {
    return { success: false, message: 'notifyChatId is required for confirmation flow' };
  }

  setPendingRepair(payload.serviceName, {
    eventId: event.id,
    payload,
    createdAt: new Date().toISOString(),
  });

  if (runtime.sendFeishuCard) {
    await runtime.sendFeishuCard({
      chatId: payload.notifyChatId,
      card: createTracebackDetectedCard({
        serviceName: payload.serviceName,
        repo: `${payload.githubOwner}/${payload.githubRepo}`,
        tracebackPreview: payload.tracebackContent,
        eventId: event.id,
      }),
    });
  } else {
    await runtime.sendFeishuMessage({
      chatId: payload.notifyChatId,
      content: `发现新问题：${payload.serviceName}\n\n请通过菜单查看详情并确认修复。`,
    });
  }

  return {
    success: true,
    message: `Traceback detected for ${payload.serviceName}, waiting for confirmation`,
  };
}

async function handleAutoRepair(
  event: GatewayEvent,
  payload: TracebackDetectedPayload,
  runtime: GatewayRuntime
): Promise<{ success: boolean; message: string; claude?: unknown }> {
  const claude = await runtime.invokeMainClaude(buildWebMonitorClaudeTask(event, payload));
  updateWebMonitorClaudeRun(payload.serviceName, {
    success: claude.success,
    summary: summarizeClaudeResult(claude),
    finishedAt: new Date().toISOString(),
  });

  // Skip notification for internal events (triggered by executeRepair in card-dispatcher)
  // The card-dispatcher will handle the notification itself
  if (event.source === 'internal') {
    return {
      success: claude.success,
      message: claude.success ? claude.stdout : claude.stderr,
      claude,
    };
  }

  if (payload.notifyChatId) {
    // Skills run in workspace, check workspace triggers first, then repo triggers
    const workspaceTriggersDir = '/Users/chihayaanon/IdeaProjects/feishu-agent/workspace/.claude/triggers';
    const repoTriggersDir = payload.localRepoPath
      ? `${payload.localRepoPath}/.claude/triggers`
      : undefined;
    const parsed = parseClaudeOutput(claude.stdout, workspaceTriggersDir, repoTriggersDir);
    if (runtime.sendFeishuCard) {
      await runtime.sendFeishuCard({
        chatId: payload.notifyChatId,
        card: createWebMonitorResultCard({
          serviceName: payload.serviceName,
          repo: `${payload.githubOwner}/${payload.githubRepo}`,
          success: claude.success,
          summary: parsed,
          tracebackPreview: payload.tracebackContent,
          autoPr: payload.autoPr,
          prBaseBranch: payload.prBaseBranch,
          prDraft: payload.prDraft,
          prBranchPrefix: payload.prBranchPrefix,
        }),
      });
    } else {
      await runtime.sendFeishuMessage({
        chatId: payload.notifyChatId,
        content: formatWebMonitorResultMessage(claude),
      });
    }
  }

  return {
    success: claude.success,
    message: claude.success ? claude.stdout : claude.stderr,
    claude,
  };
}

function parseTracebackPayload(payload: unknown): TracebackDetectedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('traceback.detected payload must be an object');
  }

  const value = payload as Partial<TracebackDetectedPayload>;
  const required: Array<keyof TracebackDetectedPayload> = [
    'serviceName',
    'githubOwner',
    'githubRepo',
    'tracebackUrl',
    'tracebackContent',
  ];

  for (const key of required) {
    if (typeof value[key] !== 'string' || !value[key]) {
      throw new Error(`traceback.detected payload missing "${key}"`);
    }
  }

  return value as TracebackDetectedPayload;
}

function summarizeClaudeResult(input: {
  success: boolean;
  stdout: string;
  stderr: string;
}): string {
  const text = (input.success ? input.stdout : input.stderr || input.stdout).trim();
  return (
    text || (input.success ? 'Claude Code task completed.' : 'Claude Code task failed.')
  ).slice(0, 1200);
}

export interface ParsedRepairResult {
  status: 'success' | 'failed' | 'blocked' | 'unknown';
  rootCause: string;
  changes: string;
  verification: string;
  pr: string;
  followUp: string;
}

import fs from 'fs';
import path from 'path';

export function parseClaudeOutput(
  stdout: string,
  workspaceTriggersDir?: string,
  repoTriggersDir?: string
): ParsedRepairResult {
  // Directories to check in order (workspace first, then repo)
  const dirsToCheck: string[] = [];
  if (workspaceTriggersDir) {
    dirsToCheck.push(workspaceTriggersDir);
  }
  if (repoTriggersDir && repoTriggersDir !== workspaceTriggersDir) {
    dirsToCheck.push(repoTriggersDir);
  }

  // Try each directory for result files
  for (const triggersDir of dirsToCheck) {
    try {
      // Try JSON file
      const jsonPath = path.join(triggersDir, 'result.json');
      if (fs.existsSync(jsonPath)) {
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        return {
          status: parsed.status || 'unknown',
          rootCause: parsed.root_cause || '未识别',
          changes: parsed.changes || '无变更',
          verification: parsed.verification || '未执行',
          pr: parsed.pr || '未创建',
          followUp: parsed.follow_up || '无',
        };
      }

      // Try markdown file (result.md)
      const mdPath = path.join(triggersDir, 'result.md');
      if (fs.existsSync(mdPath)) {
        const mdContent = fs.readFileSync(mdPath, 'utf-8');

        // Parse markdown sections
        const statusMatch = mdContent.match(/## Status:\s*(\w+)/i);
        const rootCauseMatch = mdContent.match(/## Root Cause\s*\n([\s\S]*?)(?=\n##|$)/i);
        const changesMatch = mdContent.match(/## Changes\s*\n([\s\S]*?)(?=\n##|$)/i);
        const verificationMatch = mdContent.match(/## Verification\s*\n([\s\S]*?)(?=\n##|$)/i);
        const prMatch = mdContent.match(/## PR\s*\n([\s\S]*?)(?=\n##|$)/i);
        const followUpMatch = mdContent.match(/## Follow-up\s*\n([\s\S]*?)(?=\n##|$)/i);

        return {
          status: (statusMatch?.[1]?.toLowerCase() as ParsedRepairResult['status']) || 'unknown',
          rootCause: rootCauseMatch?.[1]?.trim() || '未识别',
          changes: changesMatch?.[1]?.trim() || '无变更',
          verification: verificationMatch?.[1]?.trim() || '未执行',
          pr: prMatch?.[1]?.trim() || '未创建',
          followUp: followUpMatch?.[1]?.trim() || '无',
        };
      }
    } catch {
      // Continue to next directory
    }
  }

  // Fallback: try to extract JSON from stdout
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        status: parsed.status || 'unknown',
        rootCause: parsed.root_cause || '未识别',
        changes: parsed.changes || '无变更',
        verification: parsed.verification || '未执行',
        pr: parsed.pr || '未创建',
        followUp: parsed.follow_up || '无',
      };
    } catch {
      // Fall through to raw output
    }
  }

  // Final fallback: return raw output as rootCause
  return {
    status: 'unknown',
    rootCause: stdout.slice(0, 2000) || '无输出',
    changes: '无法解析',
    verification: '无法解析',
    pr: '无法解析',
    followUp: '无法解析',
  };
}
