import { describe, expect, it } from 'vitest';
import { continueQRPolling, renderQRAscii } from './qr-onboarding.js';

describe('renderQRAscii', () => {
  it('renders a compact terminal QR code', async () => {
    const lines = await renderQRAscii('https://example.com/oh-my-feishu');

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(20);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(40);
  });
});

describe('continueQRPolling', () => {
  it('returns cancelled without polling when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      continueQRPolling('device-code', 'feishu', 1, 1, undefined, controller.signal)
    ).resolves.toEqual({ success: false, error: 'cancelled' });
  });
});
