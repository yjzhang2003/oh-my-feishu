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

}
