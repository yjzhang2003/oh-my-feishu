/**
 * Card action dispatcher - routes card button callbacks to flows
 * Menu card updates use CardKit batch_update API for in-place updates
 */

import { SessionStore } from './session-store.js';
import { SessionHistoryStore } from './session-history-store.js';
import { ServiceAddFlow, type SendCardFn } from './flows/service-add-flow.js';
import { SessionAddFlow } from './flows/session-add-flow.js';
import { log } from '../../utils/logger.js';
import { createMainMenuCard, createNewSessionCard, createSessionHistoryCard, createSessionDetailCard, createDirectoryInputCard } from '../card-builder/menu-cards.js';
import { CardKitManager } from '../card-kit.js';

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
    sendCard: SendCardFn
  ) {
    this.serviceAddFlow = new ServiceAddFlow(sessionStore, sendCard);
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
      if (formValue?.dir_path !== undefined) {
        const dirPath = formValue.dir_path as string;
        const result = await this.sessionAddFlow.handleDirectorySubmit(chatId, dirPath);
        if (result.error) {
          return { toast: { type: 'error', content: result.error } };
        }
        return { toast: { type: 'success', content: '目录会话已创建' } };
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
        const [, actionName] = actionValue.split(':');
        return this.handleSessionAction(actionName, chatId, operatorOpenId);
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

  private handleSessionAction(action: string, chatId: string, senderOpenId: string): CardActionResponse {
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
      default:
        return { toast: { type: 'error', content: '未知会话操作' } };
    }
  }
}
