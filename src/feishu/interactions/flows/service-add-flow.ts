/**
 * Service add multi-step interaction flow
 */

import { SessionStore } from '../session-store.js';
import {
  createServiceAddStep1Card,
  createServiceAddStep2Card,
  createServiceAddStep3Card,
  createServiceAddSuccessCard,
  createServiceAddCancelledCard,
  createErrorCard,
} from '../../card-builder.js';
import type { SendCardFn } from '../../types.js';
import { log } from '../../../utils/logger.js';
import { createGatewayEvent, type GatewayFeatureRunner } from '../../../gateway/features/index.js';

export class ServiceAddFlow {
  constructor(
    private sessionStore: SessionStore,
    private sendCard: SendCardFn,
    private gatewayFeatureRunner?: GatewayFeatureRunner
  ) {}

  async start(chatId: string, senderOpenId: string): Promise<void> {
    log.info('flow', 'ServiceAddFlow started', { chatId });
    this.sessionStore.set(chatId, {
      flow: 'service-add-step1',
      data: { addedBy: senderOpenId, notifyChatId: chatId },
    });
    await this.sendCard(chatId, createServiceAddStep1Card());
  }

  async handleInput(chatId: string, text: string, senderOpenId: string): Promise<void> {
    const session = this.sessionStore.get(chatId);

    switch (session.flow) {
      case 'service-add-step1':
        await this.handleStep1(chatId, text);
        break;
      case 'service-add-step2':
        await this.handleStep2(chatId, text);
        break;
      case 'service-add-step3':
        await this.handleStep3(chatId, text, senderOpenId);
        break;
      default:
        // Not in this flow, ignore
        break;
    }
  }

  async cancel(chatId: string): Promise<void> {
    log.info('flow', 'ServiceAddFlow cancelled', { chatId });
    this.sessionStore.clear(chatId);
    await this.sendCard(chatId, createServiceAddCancelledCard());
  }

  private async handleStep1(chatId: string, name: string): Promise<void> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      await this.sendCard(chatId, createErrorCard('服务名称不能为空'));
      return;
    }

    // Validate name format (kebab-case or snake_case, no spaces)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      await this.sendCard(chatId, createErrorCard('服务名称只能包含字母、数字、下划线和连字符'));
      return;
    }

    // Check if name already exists
    const { getService } = await import('../../../service/registry.js');
    const existing = getService(trimmedName);
    if (existing) {
      await this.sendCard(chatId, createErrorCard(`服务 "${trimmedName}" 已存在`));
      return;
    }

    log.info('flow', 'ServiceAddFlow step1 complete', { chatId, name: trimmedName });
    this.sessionStore.set(chatId, {
      flow: 'service-add-step2',
      data: { ...this.sessionStore.get(chatId).data, name: trimmedName },
    });
    await this.sendCard(chatId, createServiceAddStep2Card(trimmedName));
  }

  private async handleStep2(chatId: string, repo: string): Promise<void> {
    const trimmedRepo = repo.trim();

    // Validate repo format: owner/repo
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmedRepo)) {
      await this.sendCard(chatId, createErrorCard('仓库格式错误，请使用 owner/repo 格式'));
      return;
    }

    log.info('flow', 'ServiceAddFlow step2 complete', { chatId, repo: trimmedRepo });
    this.sessionStore.set(chatId, {
      flow: 'service-add-step3',
      data: { ...this.sessionStore.get(chatId).data, repo: trimmedRepo },
    });
    await this.sendCard(chatId, createServiceAddStep3Card(
      this.sessionStore.get(chatId).data.name as string,
      trimmedRepo
    ));
  }

  private async handleStep3(chatId: string, tracebackUrl: string, senderOpenId: string): Promise<void> {
    const trimmedUrl = tracebackUrl.trim();

    // Validate URL format
    if (!/^https?:\/\/.+/.test(trimmedUrl)) {
      await this.sendCard(chatId, createErrorCard('URL 必须以 http:// 或 https:// 开头'));
      return;
    }

    const session = this.sessionStore.get(chatId);
    const name = session.data.name as string;
    const repo = session.data.repo as string;

    try {
      if (this.gatewayFeatureRunner) {
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
            tracebackUrl: trimmedUrl,
            notifyChatId: chatId,
            addedBy: senderOpenId,
          },
        }));

        if (!result.success) {
          throw new Error(result.message || String(result.data?.elements || 'Gateway feature failed'));
        }
      } else {
        const { addService } = await import('../../../service/registry.js');
        const [githubOwner, githubRepo] = repo.split('/');
        addService({
          name,
          githubOwner,
          githubRepo,
          tracebackUrl: trimmedUrl,
          notifyChatId: chatId,
          tracebackUrlType: 'json',
          enabled: true,
          addedAt: new Date().toISOString(),
          addedBy: senderOpenId,
        });
      }

      log.info('flow', 'ServiceAddFlow completed', { chatId, name, repo });
      this.sessionStore.clear(chatId);
      await this.sendCard(chatId, createServiceAddSuccessCard(name, repo, trimmedUrl));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      log.error('flow', 'ServiceAddFlow failed to add service', { chatId, error: msg });
      await this.sendCard(chatId, createErrorCard(`注册失败: ${msg}`));
    }
  }
}
