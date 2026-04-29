import type { CommandHandler, CommandContext } from './types.js';

export class TestCardCommand implements CommandHandler {
  name = '/test-card';
  description = 'Test streaming card (dev only)';

  async execute(ctx: CommandContext): Promise<void> {
    const cardKit = ctx.cardKitManager;
    if (!cardKit) {
      await ctx.sendText('❌ cardKitManager not available');
      return;
    }

    let cardId: string | null = null;
    let sequence = 1;

    const cardJson = {
      schema: '2.0',
      header: {
        title: { content: 'Test Card', tag: 'plain_text' },
        subtitle: { content: 'streaming test', tag: 'plain_text' },
        template: 'wathet',
      },
      config: {
        streaming_mode: true,
        update_multi: true,
        summary: { content: '[测试中...]' },
      },
      body: {
        elements: [],
      },
    };

    try {
      cardId = await cardKit.createCard(cardJson);
      if (!cardId) {
        await ctx.sendText('❌ Failed to create card');
        return;
      }

      await ctx.sendText(`✅ Card created: ${cardId}`);

      // Send the card to the chat
      if (ctx.sendCardById) {
        await ctx.sendCardById(cardId);
      } else {
        await ctx.sendText('⚠️ sendCardById not available');
        return;
      }

      // Stream into m1 — updateCardContent sends FULL text (not delta)
      await cardKit.addCardElements(
        cardId,
        [{ tag: 'markdown', content: '', element_id: 'm1' }],
        'append',
        undefined,
        sequence++
      );
      await cardKit.updateCardContent(cardId, 'm1', 'Hello ', sequence++);
      await cardKit.updateCardContent(cardId, 'm1', 'Hello World!', sequence++);

      // Stream into m2
      await cardKit.addCardElements(
        cardId,
        [{ tag: 'markdown', content: '', element_id: 'm2' }],
        'append',
        undefined,
        sequence++
      );
      await cardKit.updateCardContent(cardId, 'm2', 'Second block works!', sequence++);

      // Note: don't turn off streaming_mode — doing so causes Feishu to re-render
      // and the streamed content disappears. Card stays in streaming mode permanently.

      await ctx.sendText('✅ Test complete — check the card');
    } catch (err) {
      await ctx.sendText(`❌ Test failed: ${String(err).slice(0, 200)}`);
    }
  }
}
