/**
 * Card action dispatcher - routes card button callbacks to flows
 * Menu card updates use CardKit batch_update API for in-place updates
 */

import { SessionStore } from './session-store.js';
import { SessionHistoryStore } from './session-history-store.js';
import { ServiceAddFlow } from './flows/service-add-flow.js';
import { SessionAddFlow } from './flows/session-add-flow.js';
import type { SendCardFn } from '../types.js';
import { log } from '../../utils/logger.js';
import {
  createCommandMenuCard,
  createDirectoryInputCard,
  createGatewayMenuCard,
  createMainMenuCard,
  createNewSessionCard,
  createSessionDetailCard,
  createSessionHistoryCard,
  createWebMonitorDetailCard,
  createWebMonitorInputCard,
  createWebMonitorMenuCard,
} from '../card-builder/menu-cards.js';
import { CardKitManager } from '../card-kit.js';
import { createGatewayEvent, type GatewayFeatureRunner } from '../../gateway/features/index.js';
import { getService, listServices, removeService } from '../../service/registry.js';
import { removeServiceRepository } from '../../service/repository.js';
import { getWorkspaceDir } from '../../config/paths.js';
import { resolve } from 'path';

export interface CardActionPayload {
  schema?: string;
  event_id?: string;
  token?: string;
  event_type?: string;
  operator?: { open_id?: string; user_id?: string; union_id?: string };
  action?: {
    value?: Record<string, unknown>;
    tag?: string;
    name?: string;
    form_value?: Record<string, unknown>;
  };
  context?: {
    open_message_id?: string;
    open_chat_id?: string;
  };
  host?: string;
}

export interface CardActionResponse {
  toast?: { type: 'success' | 'error' | 'info'; content: string };
  card?: {
    type: 'raw';
    data: object;
  };
}

export class CardDispatcher {
  private serviceAddFlow: ServiceAddFlow;
  private sessionAddFlow: SessionAddFlow;

  constructor(
    private sessionStore: SessionStore,
    private sessionHistoryStore: SessionHistoryStore,
    private cardKitManager: CardKitManager,
    private sendCard: SendCardFn,
    private gatewayFeatureRunner?: GatewayFeatureRunner
  ) {
    this.serviceAddFlow = new ServiceAddFlow(sessionStore, sendCard, gatewayFeatureRunner);
    this.sessionAddFlow = new SessionAddFlow(sessionStore, sessionHistoryStore, sendCard);
  }

  async dispatch(payload: CardActionPayload): Promise<CardActionResponse> {
    const chatId = payload.context?.open_chat_id ?? '';
    const operatorOpenId = payload.operator?.open_id ?? '';
    const action = payload.action;
    const actionValue = action?.value?.action as string || '';

    log.info('dispatcher', 'Card action received', { chatId, action: actionValue });

    try {
      // Handle form submission (from input card with form_submit button)
      // form_submit callback: action.tag === 'button', form_value contains input data
      // The submit button has no behaviors/value, so actionValue will be empty
      // The back button inside the form uses behaviors callback, actionValue will be 'menu:back'
      const formValue = (action as unknown as { form_value?: Record<string, unknown> }).form_value;
      if (formValue?.wm_name !== undefined || formValue?.wm_repo !== undefined || formValue?.wm_url !== undefined) {
        return await this.handleWebMonitorSubmit(chatId, operatorOpenId, formValue);
      }

      if (formValue?.dir_path !== undefined) {
        const dirPath = formValue.dir_path as string;
        const result = await this.sessionAddFlow.handleDirectorySubmit(chatId, dirPath);
        if (result.error) {
          return { toast: { type: 'error', content: result.error } };
        }
        if (result.card) {
          return this.updateMenuCard({ card: result.card, elementIds: [] }, {
            type: 'success',
            content: result.toast ?? '目录会话已创建',
          });
        }
        return { toast: { type: 'success', content: result.toast ?? '目录会话已创建' } };
      }

      if (actionValue.startsWith('menu:')) {
        return await this.handleMenuAction(actionValue, chatId);
      }

      if (actionValue.startsWith('nav:')) {
        const [, actionName] = actionValue.split(':');
        return this.handleNavAction(actionName, chatId);
      }

      if (actionValue.startsWith('service:')) {
        const [, actionName] = actionValue.split(':');
        return this.handleServiceAction(actionName, chatId, operatorOpenId);
      }

      if (actionValue.startsWith('session:')) {
        return this.handleSessionAction(actionValue, chatId, operatorOpenId);
      }

      if (actionValue.startsWith('web-monitor-')) {
        return await this.handleWebMonitorRepairAction(action?.value || {}, chatId);
      }

      return { toast: { type: 'error', content: '未知操作' } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error('dispatcher', 'Card dispatch error', { chatId, action: actionValue, error: msg });
      return { toast: { type: 'error', content: `操作失败: ${msg}` } };
    }
  }

  private async handleMenuAction(actionValue: string, chatId: string): Promise<CardActionResponse> {
    const parts = actionValue.split(':');
    const subAction = parts[1];
    const param = parts[2];

    switch (subAction) {
      case 'new':
        return this.updateMenuCard(createNewSessionCard(), { type: 'info', content: '' });

      case 'new-direct':
        this.sessionStore.set(chatId, { mode: 'direct', flow: 'none' });
        return this.updateMenuCard(createMainMenuCard(), { type: 'success', content: '已切换到直接对话模式' });

      case 'new-directory':
        return this.updateMenuCard({ card: createDirectoryInputCard(), elementIds: [] }, { type: 'info', content: '' });

      case 'history': {
        const entries = this.sessionHistoryStore.listHistory(chatId);
        return this.updateMenuCard(createSessionHistoryCard(entries), { type: 'info', content: '' });
      }

      case 'gateway':
        return this.updateMenuCard(createGatewayMenuCard(), { type: 'info', content: '' });

      case 'gateway-web-monitor':
        return this.updateMenuCard(createWebMonitorMenuCard(), { type: 'info', content: '' });

      case 'web-monitor-detail': {
        const service = getService(param);
        if (!service) {
          return { toast: { type: 'error', content: '监控服务不存在' } };
        }
        return this.updateMenuCard(createWebMonitorDetailCard(service), { type: 'info', content: '' });
      }

      case 'web-monitor-delete': {
        const service = getService(param);
        if (!service) {
          return { toast: { type: 'error', content: '监控服务不存在' } };
        }
        const removed = removeService(param);
        if (removed && service.localRepoPath) {
          removeServiceRepository(param);
        }
        return this.updateMenuCard(createWebMonitorMenuCard(listServices()), {
          type: 'success',
          content: `已删除监控：${param}`,
        });
      }

      case 'web-monitor-clear-hash': {
        const service = getService(param);
        if (!service) {
          return { toast: { type: 'error', content: '监控服务不存在' } };
        }
        // Clear hash to allow re-detection of the same traceback
        const { updateService } = await import('../../service/registry.js');
        updateService(param, { lastErrorHash: undefined });
        return this.updateMenuCard(createWebMonitorDetailCard(getService(param)!), {
          type: 'success',
          content: '已清除 Hash，下次轮询将重新检测',
        });
      }

      case 'web-monitor-session': {
        const service = getService(param);
        if (!service) {
          return { toast: { type: 'error', content: '监控服务不存在' } };
        }
        if (!service.localRepoPath) {
          return { toast: { type: 'error', content: '该服务没有本地仓库目录' } };
        }
        this.sessionStore.set(chatId, {
          mode: 'directory',
          flow: 'none',
          data: { directory: service.localRepoPath },
        });
        this.sessionHistoryStore.addHistory(chatId, {
          directory: service.localRepoPath,
          sessionId: null,
        });
        return this.updateMenuCard(createWebMonitorDetailCard(service), {
          type: 'success',
          content: `已切换到目录会话：${service.localRepoPath}`,
        });
      }

      case 'gateway-new-service':
        return { toast: { type: 'info', content: '新建 Gateway 服务暂未实现' } };

      case 'web-monitor-new':
        return this.updateMenuCard({ card: createWebMonitorInputCard(), elementIds: [] }, { type: 'info', content: '' });

      case 'commands':
        return this.updateMenuCard(createCommandMenuCard(), { type: 'info', content: '' });

      case 'detail': {
        const index = parseInt(param, 10);
        const entry = this.sessionHistoryStore.getEntry(chatId, index);
        if (!entry) {
          return { toast: { type: 'error', content: '会话不存在' } };
        }
        return this.updateMenuCard(createSessionDetailCard(entry, index), { type: 'info', content: '' });
      }

      case 'resume': {
        const resumeIndex = parseInt(param, 10);
        const entry = this.sessionHistoryStore.getEntry(chatId, resumeIndex);
        if (!entry) {
          return { toast: { type: 'error', content: '会话不存在' } };
        }
        this.sessionHistoryStore.addHistory(chatId, {
          directory: entry.directory,
          sessionId: entry.sessionId,
        });
        this.sessionStore.set(chatId, {
          mode: 'directory',
          flow: 'none',
          data: { directory: entry.directory, sessionId: entry.sessionId },
        });
        return this.updateMenuCard(createMainMenuCard(), { type: 'success', content: `已恢复目录会话: ${entry.directory}` });
      }

      case 'delete': {
        const deleteIndex = parseInt(param, 10);
        this.sessionHistoryStore.removeHistory(chatId, deleteIndex);
        const updatedEntries = this.sessionHistoryStore.listHistory(chatId);
        return this.updateMenuCard(createSessionHistoryCard(updatedEntries), { type: 'success', content: '已删除历史会话' });
      }

      case 'back':
        return this.updateMenuCard(createMainMenuCard(), { type: 'info', content: '' });

      default:
        return { toast: { type: 'error', content: '未知菜单操作' } };
    }
  }

  /**
   * Return card update via callback response (not batch_update API)
   * According to Feishu docs, batch_update cannot be used during user interaction (error 200810)
   * Instead, we return the new card directly in the callback response
   */
  private updateMenuCard(
    buildResult: { card: object; elementIds: string[] },
    toast: { type: 'success' | 'error' | 'info'; content: string }
  ): CardActionResponse {
    const { card } = buildResult;

    const response: CardActionResponse = {
      toast: toast.content ? toast : undefined,
      card: {
        type: 'raw',
        data: card,
      },
    };

    return response;
  }

  private async handleWebMonitorSubmit(
    chatId: string,
    senderOpenId: string,
    formValue: Record<string, unknown>
  ): Promise<CardActionResponse> {
    if (!this.gatewayFeatureRunner) {
      return { toast: { type: 'error', content: 'Gateway feature runner is not configured.' } };
    }

    const name = String(formValue.wm_name || '').trim();
    const repo = String(formValue.wm_repo || '').trim();
    const tracebackUrl = String(formValue.wm_url || '').trim();
    const autoPr = String(formValue.wm_auto_pr || 'false') === 'true';
    const prBaseBranch = String(formValue.wm_pr_base || 'main').trim() || 'main';
    const prDraft = String(formValue.wm_pr_mode || 'draft') !== 'ready';
    const prBranchPrefix = String(formValue.wm_pr_branch_prefix || 'oh-my-feishu/web-monitor').trim()
      || 'oh-my-feishu/web-monitor';
    const requireConfirmation = String(formValue.wm_require_confirmation || 'false') === 'true';

    if (!name || !repo || !tracebackUrl) {
      return { toast: { type: 'error', content: '请填写服务名称、仓库和 Traceback URL' } };
    }

    const event = createGatewayEvent({
      feature: 'service-admin',
      type: 'service.command',
      source: 'feishu',
      chatId,
      senderOpenId,
      payload: {
        action: 'add',
        name,
        repo,
        tracebackUrl,
        notifyChatId: chatId,
        addedBy: senderOpenId,
        autoPr,
        prBaseBranch,
        prDraft,
        prBranchPrefix,
        requireConfirmation,
      },
    });

    void this.gatewayFeatureRunner.run(event)
      .then(async (result) => {
        if (!result.success) {
          const elements = Array.isArray(result.data?.elements)
            ? result.data.elements.join('\n')
            : result.message || '注册失败';
          await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
            '监控创建失败',
            elements,
            'red'
          ));
          return;
        }

        await this.sendCard(chatId, createWebMonitorMenuCard().card);
      })
      .catch(async (error) => {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        log.error('dispatcher', 'Web monitor registration failed', { chatId, name, error: msg });
        await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
          '监控创建失败',
          msg,
          'red'
        ));
      });

    return {
      toast: {
        type: 'info',
        content: `正在创建监控：${name}，仓库克隆完成后会发送结果卡片`,
      },
    };
  }

  private createWebMonitorRegistrationResultCard(
    title: string,
    content: string,
    template: 'red' | 'green'
  ): object {
    return {
      schema: '2.0',
      header: {
        title: { tag: 'plain_text', content: title },
        template,
      },
      config: {
        update_multi: true,
        summary: { content: title },
      },
      body: {
        elements: [
          {
            tag: 'markdown',
            content,
          },
        ],
      },
    };
  }

  private async handleWebMonitorRepairAction(
    actionValue: Record<string, unknown>,
    chatId: string
  ): Promise<CardActionResponse> {
    const action = actionValue.action as string || '';
    const serviceName = actionValue.serviceName as string || '';

    if (!serviceName) {
      return { toast: { type: 'error', content: '缺少服务名称' } };
    }

    switch (action) {
      case 'web-monitor-skip': {
        const { removePendingRepair } = await import('../../gateway/features/web-monitor/feature.js');
        removePendingRepair(serviceName);
        return { toast: { type: 'info', content: `已跳过 ${serviceName} 的修复` } };
      }

      case 'web-monitor-analyze': {
        const { getPendingRepair, setPendingRepair } = await import('../../gateway/features/web-monitor/feature.js');
        const pending = getPendingRepair(serviceName);

        if (!pending) {
          return { toast: { type: 'error', content: '未找到待修复记录，可能已过期' } };
        }

        // Prevent duplicate clicks - mark as analyzing
        if (pending.analyzing) {
          return { toast: { type: 'info', content: '分析已在进行中...' } };
        }

        setPendingRepair(serviceName, { ...pending, analyzing: true });
        void this.runAnalysis(serviceName, pending, chatId);
        return { toast: { type: 'info', content: `正在分析 ${serviceName} 的问题...` } };
      }

      case 'web-monitor-confirm-repair': {
        const { getPendingRepair, removePendingRepair } = await import('../../gateway/features/web-monitor/feature.js');
        const pending = getPendingRepair(serviceName);

        if (!pending) {
          return { toast: { type: 'error', content: '未找到待修复记录，可能已过期' } };
        }

        removePendingRepair(serviceName);
        void this.executeRepair(serviceName, pending, chatId);
        return { toast: { type: 'info', content: `正在执行 ${serviceName} 的修复...` } };
      }

      default:
        return { toast: { type: 'error', content: '未知的修复操作' } };
    }
  }

  private async runAnalysis(
    serviceName: string,
    pending: { eventId: string; payload: import('../../gateway/features/web-monitor/feature.js').TracebackDetectedPayload },
    chatId: string
  ): Promise<void> {
    if (!this.gatewayFeatureRunner) {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '分析失败',
        'Gateway feature runner 未配置',
        'red'
      ));
      return;
    }

    const { buildWebMonitorAnalyzeTask } = await import('../../gateway/features/web-monitor/service-actions.js');
    const { createRepairConfirmCard } = await import('../../gateway/features/web-monitor/cards.js');
    const runtime = this.gatewayFeatureRunner['options']?.runtime;

    if (!runtime) {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '分析失败',
        'Runtime 未配置',
        'red'
      ));
      return;
    }

    const event = createGatewayEvent({
      id: pending.eventId,
      type: 'traceback.analyze',
      source: 'internal',
      payload: pending.payload,
    });

    const task = buildWebMonitorAnalyzeTask(event, pending.payload);
    const result = await runtime.invokeMainClaude(task);

    if (!result.success) {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '分析失败',
        result.stderr || result.stdout || '未知错误',
        'red'
      ));
      return;
    }

    // Try to read from analysis file first
    // Skills run in workspace, check workspace triggers first, then repo triggers
    const workspaceTriggersDir = resolve(getWorkspaceDir(), '.claude', 'triggers');
    const repoTriggersDir = pending.payload.localRepoPath
      ? `${pending.payload.localRepoPath}/.claude/triggers`
      : undefined;

    let analysisResult: string = '';
    try {
      let parsed: {
        root_cause?: string;
        risk_level?: string;
        risk_reason?: string;
        affected_files?: Array<{ path: string }>;
        proposed_fix?: string;
        verification_command?: string;
      } | null = null;

      const fs = await import('fs');

      // Try JSON file in workspace first, then repo
      const dirsToCheck = [workspaceTriggersDir, repoTriggersDir].filter(Boolean) as string[];
      for (const dir of dirsToCheck) {
        if (fs.existsSync(`${dir}/analysis.json`)) {
          const fileContent = fs.readFileSync(`${dir}/analysis.json`, 'utf-8');
          parsed = JSON.parse(fileContent);
          break;
        }
      }

      // Try result.md markdown file as fallback
      if (!parsed) {
        for (const dir of dirsToCheck) {
          if (fs.existsSync(`${dir}/result.md`)) {
            const mdContent = fs.readFileSync(`${dir}/result.md`, 'utf-8');
            // Parse markdown sections
            const rootCauseMatch = mdContent.match(/## Root Cause\s*\n([\s\S]*?)(?=\n##|$)/i);
            const changesMatch = mdContent.match(/## Changes\s*\n([\s\S]*?)(?=\n##|$)/i);
            const verificationMatch = mdContent.match(/## Verification\s*\n([\s\S]*?)(?=\n##|$)/i);
            const followUpMatch = mdContent.match(/## Follow-up\s*\n([\s\S]*?)(?=\n##|$)/i);

            if (rootCauseMatch || changesMatch) {
              analysisResult = [
                rootCauseMatch ? `**根本原因**:\n${rootCauseMatch[1].trim()}` : '',
                changesMatch ? `**代码变更**:\n${changesMatch[1].trim()}` : '',
                verificationMatch ? `**验证结果**:\n${verificationMatch[1].trim()}` : '',
                followUpMatch ? `**后续操作**:\n${followUpMatch[1].trim()}` : '',
              ].filter(Boolean).join('\n\n');
              break;
            }
          }
        }
      }

      // Fallback to stdout JSON
      if (!parsed && !analysisResult) {
        const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      if (parsed && !analysisResult) {
        analysisResult = [
          `**根本原因**: ${parsed.root_cause || '未识别'}`,
          `**风险等级**: ${parsed.risk_level || '未知'} (${parsed.risk_reason || ''})`,
          `**涉及文件**: ${(parsed.affected_files || []).map((f) => f.path).join(', ') || '未识别'}`,
          `**修复方案**: ${parsed.proposed_fix || '未提供'}`,
          `**验证命令**: ${parsed.verification_command || '未提供'}`,
        ].join('\n\n');
      }

      // Final fallback: use stdout directly
      if (!analysisResult) {
        analysisResult = result.stdout.slice(0, 3000);
      }
    } catch {
      analysisResult = result.stdout.slice(0, 3000);
    }

    await this.sendCard(chatId, {
      card: createRepairConfirmCard({
        serviceName,
        repo: `${pending.payload.githubOwner}/${pending.payload.githubRepo}`,
        analysisResult,
        eventId: pending.eventId,
        autoPr: pending.payload.autoPr,
        prBaseBranch: pending.payload.prBaseBranch,
        prDraft: pending.payload.prDraft,
      }),
      elementIds: [],
    }.card);
  }

  private async runRepair(
    serviceName: string,
    pending: { eventId: string; payload: import('../../gateway/features/web-monitor/feature.js').TracebackDetectedPayload },
    chatId: string
  ): Promise<void> {
    if (!this.gatewayFeatureRunner) {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '修复失败',
        'Gateway feature runner 未配置',
        'red'
      ));
      return;
    }

    const event = createGatewayEvent({
      id: pending.eventId,
      type: 'traceback.detected',
      source: 'internal',
      payload: pending.payload,
    });

    const result = await this.gatewayFeatureRunner.run(event);

    if (result.success) {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '修复完成',
        result.message || `${serviceName} 修复完成`,
        'green'
      ));
    } else {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '修复失败',
        result.message || `${serviceName} 修复失败`,
        'red'
      ));
    }
  }

  private async executeRepair(
    serviceName: string,
    pending: { eventId: string; payload: import('../../gateway/features/web-monitor/feature.js').TracebackDetectedPayload },
    chatId: string
  ): Promise<void> {
    if (!this.gatewayFeatureRunner) {
      await this.sendCard(chatId, this.createWebMonitorRegistrationResultCard(
        '修复失败',
        'Gateway feature runner 未配置',
        'red'
      ));
      return;
    }

    const event = createGatewayEvent({
      id: pending.eventId,
      type: 'traceback.detected',
      source: 'internal',
      payload: { ...pending.payload, requireConfirmation: false },
    });

    const result = await this.gatewayFeatureRunner.run(event);

    // Parse the Claude output and send a structured result card
    const { createWebMonitorResultCard } = await import('../../gateway/features/web-monitor/cards.js');
    const { parseClaudeOutput } = await import('../../gateway/features/web-monitor/feature.js');
    type ParsedRepairResult = import('../../gateway/features/web-monitor/feature.js').ParsedRepairResult;

    // Result file path - skills run in workspace, so check there first
    const workspaceTriggersDir = resolve(getWorkspaceDir(), '.claude', 'triggers');
    const repoTriggersDir = pending.payload.localRepoPath
      ? `${pending.payload.localRepoPath}/.claude/triggers`
      : undefined;

    const claudeResult = result.claude as { stdout: string; stderr: string } | undefined;
    const parsed: ParsedRepairResult = claudeResult
      ? parseClaudeOutput(claudeResult.stdout || claudeResult.stderr || '', workspaceTriggersDir, repoTriggersDir)
      : {
          status: 'unknown',
          rootCause: result.message || '未知结果',
          changes: '无法解析',
          verification: '无法解析',
          pr: '无法解析',
          followUp: '无法解析',
        };

    await this.sendCard(chatId, {
      card: createWebMonitorResultCard({
        serviceName,
        repo: `${pending.payload.githubOwner}/${pending.payload.githubRepo}`,
        success: result.success,
        summary: parsed,
        tracebackPreview: pending.payload.tracebackContent,
        autoPr: pending.payload.autoPr,
        prBaseBranch: pending.payload.prBaseBranch,
        prDraft: pending.payload.prDraft,
        prBranchPrefix: pending.payload.prBranchPrefix,
      }),
      elementIds: [],
    }.card);
  }

  private handleNavAction(action: string, chatId: string): CardActionResponse {
    log.info('dispatcher', 'Nav action', { chatId, action });

    switch (action) {
      case 'back':
        return this.updateMenuCard(createMainMenuCard(), { type: 'info', content: '' });
      case 'repair':
        return { toast: { type: 'info', content: '请输入要修复的问题描述' } };
      case 'service':
        return { toast: { type: 'info', content: '打开服务管理...' } };
      default:
        return { toast: { type: 'error', content: '未知导航操作' } };
    }
  }

  private handleServiceAction(action: string, chatId: string, senderOpenId: string): CardActionResponse {
    switch (action) {
      case 'add-start':
        this.serviceAddFlow.start(chatId, senderOpenId);
        return { toast: { type: 'info', content: '开始注册服务...' } };
      case 'add-cancel':
        this.serviceAddFlow.cancel(chatId);
        return {};
      case 'list':
        return { toast: { type: 'info', content: '使用 /service list 查看' } };
      default:
        return { toast: { type: 'error', content: '未知服务操作' } };
    }
  }

  private async handleSessionAction(actionValue: string, chatId: string, senderOpenId: string): Promise<CardActionResponse> {
    const [, action, param] = actionValue.split(':');
    log.info('dispatcher', 'Session action', { chatId, action });

    switch (action) {
      case 'direct':
        this.sessionStore.set(chatId, { mode: 'direct', flow: 'none' });
        return this.updateMenuCard(createMainMenuCard(), { type: 'info', content: '' });
      case 'directory':
        this.sessionAddFlow.start(chatId, senderOpenId);
        return {};
      case 'add-cancel':
        this.sessionAddFlow.cancel(chatId);
        return {};
      case 'select': {
        const result = param === 'new'
          ? await this.sessionAddFlow.createNewSession(chatId)
          : await this.sessionAddFlow.selectExistingSessionById(chatId, param);
        if (result.error) {
          return { toast: { type: 'error', content: result.error } };
        }
        if (result.card) {
          return this.updateMenuCard({ card: result.card, elementIds: [] }, {
            type: 'success',
            content: result.toast ?? '目录会话已创建',
          });
        }
        return { toast: { type: 'success', content: result.toast ?? '目录会话已创建' } };
      }
      default:
        return { toast: { type: 'error', content: '未知会话操作' } };
    }
  }
}
