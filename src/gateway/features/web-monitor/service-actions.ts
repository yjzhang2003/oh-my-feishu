import type { ClaudeTaskInput, GatewayEvent } from '../types.js';
import type { TracebackDetectedPayload } from './feature.js';

export function buildWebMonitorClaudeTask(
  event: GatewayEvent,
  payload: TracebackDetectedPayload
): ClaudeTaskInput {
  return {
    feature: 'web-monitor',
    instruction: [
      '处理一个 Web 服务 traceback 监控事件。',
      '请读取 auto-repair / service-manager 相关能力，分析错误、尝试修复，并只输出最终结果。',
      '如果完成了修复，请说明修改点、验证结果和后续需要用户处理的事项。',
    ].join('\n'),
    cwd: payload.localRepoPath,
    context: {
      eventId: event.id,
      serviceName: payload.serviceName,
      repo: `${payload.githubOwner}/${payload.githubRepo}`,
      localRepoPath: payload.localRepoPath,
      tracebackUrl: payload.tracebackUrl,
      tracebackContent: payload.tracebackContent,
      previousHash: payload.previousHash,
      currentHash: payload.currentHash,
    },
    env: {
      SERVICE_NAME: payload.serviceName,
      GITHUB_REPO_OWNER: payload.githubOwner,
      GITHUB_REPO_NAME: payload.githubRepo,
      TRACEBACK_URL: payload.tracebackUrl,
      ...(payload.notifyChatId ? { NOTIFY_CHAT_ID: payload.notifyChatId } : {}),
    },
  };
}
