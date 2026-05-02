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
    sendCard: SendCardFn,
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
        return await this.handleMenuAction(actionValue, chatId, operatorOpenId);
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

      return { toast: { type: 'error', content: '未知操作' } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error('dispatcher', 'Card dispatch error', { chatId, action: actionValue, error: msg });
      return { toast: { type: 'error', content: `操作失败: ${msg}` } };
    }
  }

  private async handleMenuAction(actionValue: string, chatId: string, operatorOpenId: string): Promise<CardActionResponse> {
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

    if (!name || !repo || !tracebackUrl) {
      return { toast: { type: 'error', content: '请填写服务名称、仓库和 Traceback URL' } };
    }

    const result = await this.gatewayFeatureRunner.run(createGatewayEvent({
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
      },
    }));

    if (!result.success) {
      const elements = Array.isArray(result.data?.elements)
        ? result.data.elements.join('\n')
        : result.message || '注册失败';
      return { toast: { type: 'error', content: elements } };
    }

    return this.updateMenuCard(createWebMonitorMenuCard(), {
      type: 'success',
      content: `已创建监控：${name}`,
    });
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
