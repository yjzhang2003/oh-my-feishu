/**
 * CardKit API manager for creating and updating card entities
 * Uses Feishu cardkit v1 API for card-in-place updates
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { log } from '../utils/logger.js';

export class CardKitManager {
  private client: lark.Client;
  private domain: string;

  constructor(client: lark.Client, domain?: lark.Domain) {
    this.client = client;
    this.domain = domain === lark.Domain.Lark ? 'https://open.larksuite.com' : 'https://open.feishu.cn';
  }

  private async getHeaders(): Promise<Record<string, string>> {
    // @ts-ignore tokenManager is any in SDK types
    const token = await this.client.tokenManager.getTenantAccessToken({});
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
  }

  /**
   * Create a card entity via cardkit API
   * Returns card_id for subsequent updates
   */
  async createCard(cardData: object): Promise<string | null> {
    try {
      const headers = await this.getHeaders();
      const cardJsonString = JSON.stringify(cardData);
      const requestBody = {
        type: 'card_json',
        data: cardJsonString,
      };
      log.info('cardkit', 'createCard request', {
        url: `${this.domain}/open-apis/cardkit/v1/cards`,
        cardJsonString,
        cardJsonLength: cardJsonString.length,
        headers,
      });

      const response = await this.client.httpInstance.post(
        `${this.domain}/open-apis/cardkit/v1/cards`,
        requestBody,
        { headers }
      );

      log.info('cardkit', 'createCard response', { status: response.status, data: response.data });

      // cardkit response may be { card_id } directly or { code, msg, data: { card_id } }
      const cardId = (response.data?.card_id as string | undefined)
        || (response.data?.data?.card_id as string | undefined);

      if (!cardId) {
        log.error('cardkit', 'Failed to create card', { code: response.data?.code, msg: response.data?.msg, data: response.data });
        return null;
      }

      log.info('cardkit', 'Card created', { cardId });
      return cardId;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error creating card', {
        error: err.message,
        responseData: err.response?.data,
        responseStatus: err.response?.status,
      });
      return null;
    }
  }

  /**
   * Update card element content via cardkit API
   * Used for streaming text updates
   */
  async updateCardContent(
    cardId: string,
    elementId: string,
    content: string,
    sequence: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await this.client.httpInstance.put(
        `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/elements/${elementId}/content`,
        {
          content,
          uuid: crypto.randomUUID(),
          sequence,
        },
        { headers }
      );

      if (response.data?.code !== 0) {
        log.warn('cardkit', 'updateCardContent failed', {
          cardId,
          elementId,
          code: response.data?.code,
          msg: response.data?.msg,
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error updating card content', {
        cardId,
        elementId,
        error: err.message,
        responseData: err.response?.data,
      });
      return false;
    }
  }

  /**
   * Update card settings (e.g., close streaming mode)
   */
  async updateCardSettings(
    cardId: string,
    settings: object,
    sequence: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await this.client.httpInstance.put(
        `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/settings`,
        {
          settings: JSON.stringify(settings),
          uuid: crypto.randomUUID(),
          sequence,
        },
        { headers }
      );

      if (response.data?.code !== 0) {
        log.warn('cardkit', 'updateCardSettings failed', {
          cardId,
          code: response.data?.code,
          msg: response.data?.msg,
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error updating card settings', {
        cardId,
        error: err.message,
        responseData: err.response?.data,
      });
      return false;
    }
  }
}
