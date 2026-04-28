import type { CommandHandler, CommandContext } from './types.js';

export class TestCardCommand implements CommandHandler {
  name = '/test-card';
  aliases = [];
  description = 'Test sending a form card directly';

  async execute(ctx: CommandContext): Promise<void> {
    // Exact structure from Feishu official docs
    const card = {
      schema: '2.0',
      body: {
        elements: [
          {
            tag: 'form',
            elements: [
              {
                tag: 'input',
                element_id: 'username',
                placeholder: {
                  tag: 'plain_text',
                  content: '请输入',
                },
                default_value: '',
                width: 'default',
                label: {
                  tag: 'plain_text',
                  content: '目录路径：',
                },
                name: 'dir_path',
              },
              {
                tag: 'column_set',
                flex_mode: 'none',
                background_style: 'default',
                horizontal_spacing: 'default',
                columns: [
                  {
                    tag: 'column',
                    width: 'auto',
                    vertical_align: 'top',
                    elements: [
                      {
                        tag: 'button',
                        text: {
                          tag: 'plain_text',
                          content: '提交',
                        },
                        type: 'primary',
                        action_type: 'form_submit',
                        name: 'btn_submit',
                      },
                    ],
                  },
                  {
                    tag: 'column',
                    width: 'auto',
                    vertical_align: 'top',
                    elements: [
                      {
                        tag: 'button',
                        text: {
                          tag: 'plain_text',
                          content: '取消',
                        },
                        type: 'default',
                        action_type: 'form_reset',
                        name: 'btn_reset',
                      },
                    ],
                  },
                ],
                margin: '0px',
              },
            ],
            name: 'dir_form',
          },
        ],
      },
    };
    await ctx.sendCard(card);
  }
}
