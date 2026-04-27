/**
 * Card action dispatcher - routes card button callbacks to flows
 */

import { SessionStore } from './session-store.js';
import { ServiceAddFlow, type SendCardFn } from './flows/service-add-flow.js';
import { log } from '../../utils/logger.js';

export interface CardActionPayload {
  open_id: string;
  open_message_id: string;
  open_chat_id: string;
  action: {
    value: Record<string, unknown>;
    tag: string;
  };
}

export interface CardActionResponse {
  toast?: { type: 'success' | 'error' | 'info'; content: string };
  card?: object;
}

export class CardDispatcher {
  private serviceAddFlow: ServiceAddFlow;

  constructor(
    private sessionStore: SessionStore,
    sendCard: SendCardFn
  ) {
    this.serviceAddFlow = new ServiceAddFlow(sessionStore, sendCard);
  }

  async dispatch(payload: CardActionPayload): Promise<CardActionResponse> {
    const { open_chat_id: chatId, action } = payload;
    const actionValue = action.value?.action as string || '';
    const [, actionName] = actionValue.split(':');

    log.info('dispatcher', 'Card action received', { chatId, action: actionValue });

    try {
      // Route based on action prefix
      if (actionValue.startsWith('nav:')) {
        return this.handleNavAction(actionName, chatId, payload);
      }

      if (actionValue.startsWith('service:')) {
        return this.handleServiceAction(actionName, chatId, payload);
      }

      if (actionValue.startsWith('repair:')) {
        return this.handleRepairAction(actionName, chatId, payload);
      }

      if (actionValue.startsWith('session:')) {
        return this.handleSessionAction(actionName, chatId, payload);
      }

      // Unknown action
      return {
        toast: { type: 'error', content: '未知操作' },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error('dispatcher', 'Card dispatch error', { chatId, action: actionValue, error: msg });
      return {
        toast: { type: 'error', content: `操作失败: ${msg}` },
      };
    }
  }

  private handleNavAction(action: string, chatId: string, payload: CardActionPayload): CardActionResponse {
    // Navigation actions just trigger command handlers, which will be done via message-router
    // The dispatcher returns a placeholder - actual handling will be done when user sends command
    log.info('dispatcher', 'Nav action', { chatId, action });

    switch (action) {
      case 'back':
        // Return to navigation card - handled by message-router
        return {
          toast: { type: 'info', content: '返回导航' },
        };
      case 'repair':
        return {
          toast: { type: 'info', content: '请输入要修复的问题描述' },
        };
      case 'service':
        return {
          toast: { type: 'info', content: '打开服务管理...' },
        };
      case 'status':
        return {
          toast: { type: 'info', content: '查看系统状态...' },
        };
      case 'help':
        return {
          toast: { type: 'info', content: '显示帮助信息...' },
        };
      default:
        return {
          toast: { type: 'error', content: '未知导航操作' },
        };
    }
  }

  private handleServiceAction(action: string, chatId: string, payload: CardActionPayload): CardActionResponse {
    const senderOpenId = payload.open_id;

    switch (action) {
      case 'add-start':
        this.serviceAddFlow.start(chatId, senderOpenId);
        return {
          toast: { type: 'info', content: '开始注册服务...' },
        };
      case 'add-cancel':
        this.serviceAddFlow.cancel(chatId);
        return {};
      case 'list':
        return {
          toast: { type: 'info', content: '使用 /service list 查看' },
        };
      default:
        return {
          toast: { type: 'error', content: '未知服务操作' },
        };
    }
  }

  private handleRepairAction(action: string, chatId: string, payload: CardActionPayload): CardActionResponse {
    log.info('dispatcher', 'Repair action', { chatId, action });

    switch (action) {
      case 'start':
        return {
          toast: { type: 'info', content: '请输入要修复的问题描述' },
        };
      default:
        return {
          toast: { type: 'error', content: '未知修复操作' },
        };
    }
  }

  private handleSessionAction(action: string, chatId: string, payload: CardActionPayload): CardActionResponse {
    log.info('dispatcher', 'Session action', { chatId, action });

    switch (action) {
      case 'direct':
        this.sessionStore.set(chatId, { mode: 'direct' });
        return {
          toast: { type: 'success', content: '✅ 已切换到直接对话模式' },
        };
      case 'directory':
        this.sessionStore.set(chatId, { mode: 'directory' });
        return {
          toast: { type: 'info', content: '📁 请在 CLI 中运行: ohmyfeishu session new <目录>' },
        };
      case 'list':
        // List active sessions
        return {
          toast: { type: 'info', content: '📋 正在查询会话列表...' },
        };
      default:
        return {
          toast: { type: 'error', content: '未知会话操作' },
        };
    }
  }
}
