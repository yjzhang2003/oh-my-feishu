/**
 * Session add multi-step interaction flow
 * Handles creating directory sessions via Feishu UI
 */

import { SessionStore } from '../session-store.js';
import { SessionHistoryStore } from '../session-history-store.js';
import { log } from '../../../utils/logger.js';
import { createCallbackCard, md } from '../../card-builder.js';
import {
  createDirectorySessionSelectCard,
  createDirectorySessionSuccessCard,
} from '../../card-builder/menu-cards.js';
import type { SendCardFn } from '../../types.js';
import { listSessions, type SessionInfo } from '../../../trigger/invoker.js';
import { install } from '../../../marketplace/index.js';
import { existsSync, statSync } from 'fs';

export class SessionAddFlow {
  constructor(
    private sessionStore: SessionStore,
    private sessionHistoryStore: SessionHistoryStore,
    private sendCard: SendCardFn
  ) {}

  async start(chatId: string, senderOpenId: string): Promise<void> {
    log.info('flow', 'SessionAddFlow started', { chatId });
    this.sessionStore.set(chatId, {
      flow: 'session-add-step1',
      data: { addedBy: senderOpenId },
    });
    // Card is sent by card-dispatcher via createDirectoryInputCard (2.0 with form)
  }

  async handleInput(chatId: string, text: string): Promise<{ done: boolean; error?: string }> {
    const session = this.sessionStore.get(chatId);

    if (session.flow === 'session-add-step1') {
      return this.handleDirectoryInput(chatId, text);
    }

    if (session.flow === 'session-select-session') {
      return this.handleSessionSelect(chatId, text);
    }

    return { done: false };
  }

  cancel(chatId: string): void {
    log.info('flow', 'SessionAddFlow cancelled', { chatId });
    this.sessionStore.set(chatId, { flow: 'none', mode: 'direct' });
  }

  /**
   * Handle directory path submitted from input card form
   */
  async handleDirectorySubmit(chatId: string, dirPath: string): Promise<{ error?: string; card?: object; toast?: string }> {
    const trimmedDir = dirPath.trim();

    if (!trimmedDir) {
      return { error: '目录路径不能为空' };
    }

    if (!trimmedDir.startsWith('/') && !trimmedDir.startsWith('./') && !trimmedDir.startsWith('../')) {
      return { error: '请输入有效的目录路径（如 /home/user/project 或 ./my-project）' };
    }

    if (!existsSync(trimmedDir) || !statSync(trimmedDir).isDirectory()) {
      return { error: `目录不存在: \`${trimmedDir}\`` };
    }

    // Store directory and list sessions
    this.sessionStore.set(chatId, {
      flow: 'session-select-session',
      data: { directory: trimmedDir },
    });

    // List sessions in directory
    const sessions = await listSessions(trimmedDir);

    if (sessions.length > 0) {
      return {
        card: createDirectorySessionSelectCard(trimmedDir, sessions).card,
        toast: '请选择要连接的 Claude Code 会话',
      };
    } else {
      // No sessions, install plugin and create new
      await this.completeSession(chatId, trimmedDir, null);
      return {
        card: createDirectorySessionSuccessCard(trimmedDir, null).card,
        toast: '目录会话已创建',
      };
    }
  }

  private async handleDirectoryInput(chatId: string, text: string): Promise<{ done: boolean; error?: string }> {
    const result = await this.handleDirectorySubmit(chatId, text);
    if (result.error) {
      await this.sendCard(chatId, this.createErrorCard(result.error));
      return { done: false };
    }
    if (result.card) {
      await this.sendCard(chatId, result.card);
    }
    return { done: true };
  }

  private async handleSessionSelect(chatId: string, text: string): Promise<{ done: boolean; error?: string }> {
    const trimmedInput = text.trim();
    const session = this.sessionStore.get(chatId);
    const directory = session.data.directory as string;

    if (trimmedInput === 'new' || trimmedInput === '+' || trimmedInput === '新建') {
      // Install plugin and create new session
      const result = await this.createNewSession(chatId);
      if (result.card) await this.sendCard(chatId, result.card);
      return { done: !result.error, error: result.error };
    }

    // Try to parse as session ID selection
    // User might enter just a number or partial ID
    const sessions = await listSessions(directory);
    const selectedIndex = parseInt(trimmedInput, 10) - 1;

    if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < sessions.length) {
      const result = await this.selectExistingSession(chatId, selectedIndex);
      if (result.card) await this.sendCard(chatId, result.card);
      return { done: !result.error, error: result.error };
    }

    // Try matching by session ID prefix
    const matched = sessions.find(s => s.id.startsWith(trimmedInput));
    if (matched) {
      const result = await this.selectExistingSessionById(chatId, matched.id);
      if (result.card) await this.sendCard(chatId, result.card);
      return { done: !result.error, error: result.error };
    }

    await this.sendCard(chatId, this.createErrorCard('无效的选择，请输入编号或 session ID'));
    return { done: false };
  }

  private async installPluginSafely(directory: string): Promise<void> {
    try {
      await install({ targetDir: directory });
      log.info('flow', 'Marketplace plugin installed', { directory });
    } catch (err) {
      log.warn('flow', 'Failed to install marketplace plugin', { directory, error: String(err) });
    }
  }

  async createNewSession(chatId: string): Promise<{ error?: string; card?: object; toast?: string }> {
    const session = this.sessionStore.get(chatId);
    const directory = session.data.directory as string | undefined;
    if (!directory) {
      return { error: '目录会话上下文不存在，请重新选择目录' };
    }

    await this.completeSession(chatId, directory, null);
    return {
      card: createDirectorySessionSuccessCard(directory, null).card,
      toast: '已创建新的目录会话',
    };
  }

  async selectExistingSession(chatId: string, index: number): Promise<{ error?: string; card?: object; toast?: string }> {
    const session = this.sessionStore.get(chatId);
    const directory = session.data.directory as string | undefined;
    if (!directory) {
      return { error: '目录会话上下文不存在，请重新选择目录' };
    }

    const sessions = await listSessions(directory);
    const selected = sessions[index];
    if (!selected) {
      return { error: '会话不存在，请重新选择' };
    }

    return this.selectExistingSessionById(chatId, selected.id);
  }

  async selectExistingSessionById(chatId: string, sessionId: string | undefined): Promise<{ error?: string; card?: object; toast?: string }> {
    if (!sessionId) {
      return { error: '会话不存在，请重新选择' };
    }

    const session = this.sessionStore.get(chatId);
    const directory = session.data.directory as string | undefined;
    if (!directory) {
      return { error: '目录会话上下文不存在，请重新选择目录' };
    }

    await this.completeSession(chatId, directory, sessionId);
    return {
      card: createDirectorySessionSuccessCard(directory, sessionId).card,
      toast: '已连接 Claude Code 会话',
    };
  }

  private async completeSession(chatId: string, directory: string, sessionId: string | null): Promise<void> {
    void this.installPluginSafely(directory);
    this.sessionStore.set(chatId, {
      flow: 'none',
      mode: 'directory',
      data: sessionId ? { directory, sessionId } : { directory },
    });
    this.sessionHistoryStore.addHistory(chatId, { directory, sessionId });
  }

  private createDirectoryInputCard() {
    return createCallbackCard({
      title: '📁 创建目录会话',
      elements: [
        md('**请输入要打开的目录路径**'),
        md(''),
        md('输入格式：'),
        md('- 绝对路径：`/home/user/my-project`'),
        md('- 相对路径：`./my-project` 或 `../parent/project`'),
        md(''),
        md('*Claude 将在指定目录中启动，可以访问项目代码和文件*'),
      ],
      buttons: [
        { text: '◀️ 取消', action: 'session:add-cancel', type: 'danger' },
      ],
      headerColor: 'purple',
    });
  }

  private createSessionSelectCard(directory: string, sessions: SessionInfo[]) {
    const elements = [
      md(`**目录：** \`${directory}\``),
      md(''),
      md('**该目录下有以下会话：**'),
      md(''),
    ];

    sessions.forEach((s, i) => {
      elements.push(md(`${i + 1}. \`${s.id}\` (${s.lastActive})`));
    });
    elements.push(md(''));
    elements.push(md('*点击下方按钮选择要连接的 Claude Code 会话，或创建新会话*'));

    return createCallbackCard({
      title: '📁 选择会话',
      elements,
      buttons: [
        ...sessions.map((s, i) => ({
          text: `${i + 1}. ${s.id.slice(0, 8)}...`,
          action: `session:select:${i}`,
          type: 'default' as const,
        })),
        { text: '+ 新建会话', action: 'session:select:new', type: 'primary' },
        { text: '◀️ 取消', action: 'session:add-cancel', type: 'danger' },
      ],
      headerColor: 'purple',
    });
  }

  private createNoSessionCard(directory: string) {
    return createCallbackCard({
      title: '✅ 目录会话已创建',
      elements: [
        md(`**目录：** \`${directory}\``),
        md(''),
        md('该目录下没有现有会话，将创建新会话。'),
        md(''),
        md('💡 发送消息开始对话'),
      ],
      headerColor: 'green',
    });
  }

  private createSuccessCard(directory: string, sessionId: string | null) {
    const sessionInfo = sessionId ? `会话: \`${sessionId.slice(0, 8)}...\`` : '新会话';
    return createCallbackCard({
      title: '✅ 目录会话已创建',
      elements: [
        md(`**目录：** \`${directory}\``),
        md(`**${sessionInfo}**`),
        md(''),
        md('Claude 进程已在指定目录中启动，可以开始对话了！'),
        md(''),
        md('💡 发送消息与 Claude 对话'),
      ],
      headerColor: 'green',
    });
  }

  private createErrorCard(message: string) {
    return createCallbackCard({
      title: '❌ 输入无效',
      elements: [
        md(`**错误：** ${message}`),
        md(''),
        md('请重新输入有效的目录路径'),
      ],
      buttons: [
        { text: '◀️ 取消', action: 'session:add-cancel', type: 'danger' },
      ],
      headerColor: 'red',
    });
  }
}
