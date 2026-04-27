/**
 * Session add multi-step interaction flow
 * Handles creating directory sessions via Feishu UI
 */

import { SessionStore } from '../session-store.js';
import { log } from '../../../utils/logger.js';
import { createCallbackCard, md } from '../../card-builder.js';
import { listSessions, type SessionInfo } from '../../../trigger/invoker.js';
import { install } from '../../../marketplace/index.js';

export interface SendCardFn {
  (chatId: string, card: object): Promise<void>;
}

export class SessionAddFlow {
  constructor(
    private sessionStore: SessionStore,
    private sendCard: SendCardFn
  ) {}

  async start(chatId: string, senderOpenId: string): Promise<void> {
    log.info('flow', 'SessionAddFlow started', { chatId });
    this.sessionStore.set(chatId, {
      flow: 'session-add-step1',
      data: { addedBy: senderOpenId },
    });
    await this.sendCard(chatId, this.createDirectoryInputCard());
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

  private async handleDirectoryInput(chatId: string, text: string): Promise<{ done: boolean; error?: string }> {
    const trimmedDir = text.trim();

    if (!trimmedDir) {
      await this.sendCard(chatId, this.createErrorCard('目录路径不能为空'));
      return { done: false };
    }

    if (!trimmedDir.startsWith('/') && !trimmedDir.startsWith('./') && !trimmedDir.startsWith('../')) {
      await this.sendCard(chatId, this.createErrorCard('请输入有效的目录路径（如 /home/user/project 或 ./my-project）'));
      return { done: false };
    }

    // Store directory and list sessions
    this.sessionStore.set(chatId, {
      flow: 'session-select-session',
      data: { directory: trimmedDir },
    });

    // List sessions in directory
    const sessions = await listSessions(trimmedDir);

    if (sessions.length > 0) {
      await this.sendCard(chatId, this.createSessionSelectCard(trimmedDir, sessions));
    } else {
      // No sessions, install plugin and create new
      try {
        install({ targetDir: trimmedDir });
        log.info('flow', 'Marketplace plugin installed', { directory: trimmedDir });
      } catch (err) {
        log.warn('flow', 'Failed to install marketplace plugin', { directory: trimmedDir, error: String(err) });
      }
      this.sessionStore.set(chatId, {
        flow: 'none',
        mode: 'directory',
        data: { directory: trimmedDir },
      });
      await this.sendCard(chatId, this.createNoSessionCard(trimmedDir));
    }

    return { done: true };
  }

  private async handleSessionSelect(chatId: string, text: string): Promise<{ done: boolean; error?: string }> {
    const trimmedInput = text.trim();
    const session = this.sessionStore.get(chatId);
    const directory = session.data.directory as string;

    if (trimmedInput === 'new' || trimmedInput === '+' || trimmedInput === '新建') {
      // Install plugin and create new session
      this.installPluginSafely(directory);
      this.sessionStore.set(chatId, {
        flow: 'none',
        mode: 'directory',
        data: { directory },
      });
      await this.sendCard(chatId, this.createSuccessCard(directory, null));
      return { done: true };
    }

    // Try to parse as session ID selection
    // User might enter just a number or partial ID
    const sessions = await listSessions(directory);
    const selectedIndex = parseInt(trimmedInput, 10) - 1;

    if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < sessions.length) {
      const selectedSession = sessions[selectedIndex];
      this.installPluginSafely(directory);
      this.sessionStore.set(chatId, {
        flow: 'none',
        mode: 'directory',
        data: { directory, sessionId: selectedSession.id },
      });
      await this.sendCard(chatId, this.createSuccessCard(directory, selectedSession.id));
      return { done: true };
    }

    // Try matching by session ID prefix
    const matched = sessions.find(s => s.id.startsWith(trimmedInput));
    if (matched) {
      this.installPluginSafely(directory);
      this.sessionStore.set(chatId, {
        flow: 'none',
        mode: 'directory',
        data: { directory, sessionId: matched.id },
      });
      await this.sendCard(chatId, this.createSuccessCard(directory, matched.id));
      return { done: true };
    }

    await this.sendCard(chatId, this.createErrorCard('无效的选择，请输入编号或 session ID'));
    return { done: false };
  }

  private installPluginSafely(directory: string): void {
    try {
      install({ targetDir: directory });
      log.info('flow', 'Marketplace plugin installed', { directory });
    } catch (err) {
      log.warn('flow', 'Failed to install marketplace plugin', { directory, error: String(err) });
    }
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
    elements.push(md('*输入编号选择，或输入 **new** 创建新会话*'));

    return createCallbackCard({
      title: '📁 选择会话',
      elements,
      buttons: [
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
