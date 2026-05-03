import type { ClaudeTaskInput, GatewayEvent } from '../types.js';
import type { TracebackDetectedPayload } from './feature.js';

export function buildWebMonitorClaudeTask(
  event: GatewayEvent,
  payload: TracebackDetectedPayload
): ClaudeTaskInput {
  return {
    feature: 'web-monitor',
    skillCommand: '/web-monitor-auto-repair',
    instruction: [
      '处理一个 Web 服务 traceback 监控事件。',
      '使用 web-monitor-auto-repair 工作流分析错误、尝试修复，并只输出最终结果。',
      '如果完成了修复，请说明修改点、验证结果和后续需要用户处理的事项。',
    ].join('\n'),
    context: {
      eventId: event.id,
      serviceName: payload.serviceName,
      repo: `${payload.githubOwner}/${payload.githubRepo}`,
      localRepoPath: payload.localRepoPath,
      tracebackUrl: payload.tracebackUrl,
      tracebackContent: payload.tracebackContent,
      autoPr: payload.autoPr ?? false,
      prBaseBranch: payload.prBaseBranch || 'main',
      prDraft: payload.prDraft ?? true,
      prBranchPrefix: payload.prBranchPrefix || 'oh-my-feishu/web-monitor',
      previousHash: payload.previousHash,
      currentHash: payload.currentHash,
    },
    env: {
      SERVICE_NAME: payload.serviceName,
      GITHUB_REPO_OWNER: payload.githubOwner,
      GITHUB_REPO_NAME: payload.githubRepo,
      TRACEBACK_URL: payload.tracebackUrl,
      TARGET_REPO_PATH: payload.localRepoPath || '',
      WEB_MONITOR_AUTO_PR: payload.autoPr ? 'true' : 'false',
      WEB_MONITOR_PR_BASE_BRANCH: payload.prBaseBranch || 'main',
      WEB_MONITOR_PR_DRAFT: payload.prDraft === false ? 'false' : 'true',
      WEB_MONITOR_PR_BRANCH_PREFIX: payload.prBranchPrefix || 'oh-my-feishu/web-monitor',
      ...(payload.notifyChatId ? { NOTIFY_CHAT_ID: payload.notifyChatId } : {}),
    },
  };
}
