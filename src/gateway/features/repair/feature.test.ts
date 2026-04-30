import { describe, expect, it, vi } from 'vitest';
import { readTrigger } from '../../../trigger/trigger.js';
import { repairFeature } from './feature.js';

describe('repairFeature', () => {
  it('writes trigger and invokes main Claude silently', async () => {
    const runtime = {
      invokeMainClaude: vi.fn(async () => ({
        success: true,
        stdout: 'repair complete',
        stderr: '',
        exitCode: 0,
      })),
      sendFeishuMessage: vi.fn(async () => {}),
    };

    const result = await repairFeature.handle({
      id: 'evt_1',
      type: 'repair.requested',
      source: 'feishu',
      payload: {
        context: 'Fix API traceback',
        chatId: 'oc_test',
        senderOpenId: 'ou_test',
      },
      createdAt: '2026-04-30T00:00:00.000Z',
    }, runtime);

    expect(result.success).toBe(true);
    expect(runtime.invokeMainClaude).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'repair',
      context: expect.objectContaining({
        repairContext: 'Fix API traceback',
      }),
    }));

    const trigger = readTrigger();
    expect(trigger?.context).toBe('Fix API traceback');
    expect(trigger?.metadata).toEqual(expect.objectContaining({
      chat_id: 'oc_test',
      sender_open_id: 'ou_test',
    }));
  });
});
