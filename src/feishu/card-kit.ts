/**
 * CardKit API manager for creating and updating card entities
 * Uses Feishu cardkit v1 API for card-in-place updates
 */
import * as crypto from 'crypto'
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
      const body = {
        content,
        uuid: crypto.randomUUID(),
        sequence,
      };
      const url = `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/elements/${elementId}/content`;
      log.info('cardkit', 'updateCardContent request', { url, body });
      const response = await this.client.httpInstance.put(url, body, { headers });

      log.info('cardkit', 'updateCardContent response', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        httpStatus: (response as any).status,
      });

      // CardKit success response may be {} without code field
      // But HTTP 400 responses land here too — check both
      const code = response.data?.code;
      if (response.data && typeof code === 'number' && code !== 0) {
        log.warn('cardkit', 'updateCardContent failed', {
          cardId,
          elementId,
          code,
          msg: response.data.msg,
          fieldViolations: response.data.error?.field_violations,
          fullResponseBody: JSON.stringify(response.data).slice(0, 500),
        });
        return false;
      }

      if (response.status && response.status >= 400) {
        log.warn('cardkit', 'updateCardContent HTTP error', {
          cardId,
          elementId,
          httpStatus: response.status,
          responseData: JSON.stringify(response.data).slice(0, 300),
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      const respData = err.response?.data;
      log.error('cardkit', 'Error updating card content', {
        cardId,
        elementId,
        error: err.message,
        responseStatus: err.response?.status,
        code: respData?.code,
        msg: respData?.msg,
        fieldViolations: respData?.error?.field_violations,
        fullData: JSON.stringify(respData).slice(0, 500),
      });
      return false;
    }
  }

  /**
   * Add new elements to an existing card via POST
   * Used to dynamically insert new collapsible_panels during streaming
   * POST /open-apis/cardkit/v1/cards/:card_id/elements
   */
  async addCardElements(
    cardId: string,
    elements: object[],
    type: 'insert_after' | 'insert_before' | 'append',
    targetElementId?: string,
    sequence?: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const body = {
        type,
        ...(targetElementId ? { target_element_id: targetElementId } : {}),
        elements: JSON.stringify(elements),
        uuid: crypto.randomUUID(),
        sequence: sequence ?? 1,
      };
      const url = `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/elements`;
      log.info('cardkit', 'addCardElements request', { url, body });
      const response = await this.client.httpInstance.post(url, body, { headers });

      log.info('cardkit', 'addCardElements response', {
        status: response.status,
        data: response.data,
      });

      if (response.data && typeof response.data.code === 'number' && response.data.code !== 0) {
        log.warn('cardkit', 'addCardElements failed', {
          cardId,
          code: response.data.code,
          msg: response.data.msg,
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error adding card elements', {
        cardId,
        error: err.message,
        responseData: err.response?.data,
      });
      return false;
    }
  }

  /**
   * Update element properties via PATCH
   * Used to set expanded: false on collapsible_panel after streaming completes
   * PATCH /open-apis/cardkit/v1/cards/:card_id/elements/:element_id
   */
  async updateCardProps(
    cardId: string,
    elementId: string,
    props: object,
    sequence: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const body = {
        partial_element: JSON.stringify(props),
        uuid: crypto.randomUUID(),
        sequence,
      };
      const url = `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/elements/${elementId}`;
      log.info('cardkit', 'updateCardProps request', { url, body });
      const response = await this.client.httpInstance.patch(url, body, { headers });

      log.info('cardkit', 'updateCardProps response', {
        status: response.status,
        data: response.data,
      });

      if (response.data && typeof response.data.code === 'number' && response.data.code !== 0) {
        log.warn('cardkit', 'updateCardProps failed', {
          cardId,
          elementId,
          code: response.data.code,
          msg: response.data.msg,
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error updating card props', {
        cardId,
        elementId,
        error: err.message,
        responseData: err.response?.data,
      });
      return false;
    }
  }

  /**
   * Delete elements from a card via batch_update.
   * POST /open-apis/cardkit/v1/cards/:card_id/batch_update
   */
  async deleteCardElements(
    cardId: string,
    elementIds: string[],
    sequence: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const actions = [
        {
          action: 'delete_elements',
          params: {
            element_ids: elementIds,
          },
        },
      ];
      const body = {
        uuid: crypto.randomUUID(),
        sequence,
        actions: JSON.stringify(actions),
      };
      const url = `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/batch_update`;
      log.info('cardkit', 'deleteCardElements request', { url, body });
      const response = await this.client.httpInstance.post(url, body, { headers });

      log.info('cardkit', 'deleteCardElements response', {
        status: response.status,
        data: response.data,
      });

      if (response.data && typeof response.data.code === 'number' && response.data.code !== 0) {
        log.warn('cardkit', 'deleteCardElements failed', {
          cardId,
          elementIds,
          code: response.data.code,
          msg: response.data.msg,
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error deleting card elements', {
        cardId,
        elementIds,
        error: err.message,
        responseData: err.response?.data,
      });
      return false;
    }
  }

  /**
   * Update card settings (streaming_mode, summary, etc.)
   * Uses batch_update API with partial_update_setting action
   */
  async updateCardSettings(
    cardId: string,
    settings: {
      streaming_mode?: boolean;
      summary?: { content: string };
    },
    sequence: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const actions = [
        {
          action: 'partial_update_setting',
          params: {
            settings: { config: settings },
          },
        },
      ];
      const body = {
        uuid: crypto.randomUUID(),
        sequence,
        actions: JSON.stringify(actions),
      };
      const url = `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/batch_update`;
      log.info('cardkit', 'updateCardSettings request', { url, body });
      const response = await this.client.httpInstance.post(url, body, { headers });

      log.info('cardkit', 'updateCardSettings response', {
        status: response.status,
        data: response.data,
      });

      if (response.data && typeof response.data.code === 'number' && response.data.code !== 0) {
        log.warn('cardkit', 'updateCardSettings failed', {
          cardId,
          code: response.data.code,
          msg: response.data.msg,
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

  /**
   * Full update card entity (e.g., close streaming mode)
   * PUT /open-apis/cardkit/v1/cards/:card_id
   */
  async updateCardFull(
    cardId: string,
    cardData: object,
    sequence: number
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await this.client.httpInstance.put(
        `${this.domain}/open-apis/cardkit/v1/cards/${cardId}`,
        {
          card: {
            type: 'card_json',
            data: JSON.stringify(cardData),
          },
          uuid: crypto.randomUUID(),
          sequence,
        },
        { headers }
      );

      // CardKit success response may be {} without code field
      if (response.data && typeof response.data.code === 'number' && response.data.code !== 0) {
        log.warn('cardkit', 'updateCardFull failed', {
          cardId,
          code: response.data.code,
          msg: response.data.msg,
          data: response.data,
        });
        return false;
      }

      return true;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error updating card full', {
        cardId,
        error: err.message,
        responseData: err.response?.data,
      });
      return false;
    }
  }
}
