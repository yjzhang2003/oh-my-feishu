import { describe, test, expect } from 'vitest';
import {
  createCallbackCard,
  createServiceAddStep1Card,
  createServiceAddStep2Card,
  createServiceAddStep3Card,
  createServiceAddSuccessCard,
  createServiceAddCancelledCard,
} from './card-builder.js';
import {
  createCommandMenuCard,
  createGatewayMenuCard,
  createMainMenuCard,
} from './card-builder/menu-cards.js';

describe('CardBuilder', () => {
  test('createCallbackCard builds card with header and elements', () => {
    const card = createCallbackCard({
      title: 'Test Card',
      elements: [{ tag: 'markdown', content: 'Hello' }],
    });
    expect(card.header?.title.content).toBe('Test Card');
    expect(card.elements).toHaveLength(1);
  });

  test('createCallbackCard adds action buttons', () => {
    const card = createCallbackCard({
      title: 'With Buttons',
      elements: [{ tag: 'markdown', content: 'Test' }],
      buttons: [
        { text: 'Click Me', action: 'test:click', type: 'primary' },
      ],
    });
    expect(card.elements).toHaveLength(3); // element + hr + action
    const actionEl = card.elements[2] as { tag: string; actions: unknown[] };
    expect(actionEl.tag).toBe('action');
    expect(actionEl.actions).toHaveLength(1);
  });

  test('createServiceAddStep1Card contains correct guidance', () => {
    const card = createServiceAddStep1Card();
    expect(card.header?.title.content).toBe('➕ 注册服务 - Step 1/3');
    expect(card.header?.template).toBe('green');
  });

  test('createServiceAddStep2Card shows name from step 1', () => {
    const card = createServiceAddStep2Card('my-api');
    expect(card.header?.title.content).toBe('➕ 注册服务 - Step 2/3');
    expect(card.elements[0]).toEqual({ tag: 'markdown', content: '**服务名称:** `my-api` ✅' });
  });

  test('createServiceAddStep3Card shows name and repo', () => {
    const card = createServiceAddStep3Card('my-api', 'org/repo');
    expect(card.header?.title.content).toBe('➕ 注册服务 - Step 3/3');
  });

  test('createServiceAddSuccessCard contains service details', () => {
    const card = createServiceAddSuccessCard('my-api', 'org/repo', 'https://logs.example.com');
    expect(card.header?.title.content).toBe('✅ 服务注册成功');
    expect(card.header?.template).toBe('green');
  });

  test('createServiceAddCancelledCard has red header', () => {
    const card = createServiceAddCancelledCard();
    expect(card.header?.title.content).toBe('❌ 注册已取消');
    expect(card.header?.template).toBe('red');
  });

  test('main menu keeps commands behind a second-level page', () => {
    const { card } = createMainMenuCard();
    const elements = ((card as any).body.elements ?? []) as any[];

    expect(elements.some((element) => element.tag === 'table')).toBe(false);
    expect(JSON.stringify(elements)).toContain('menu:gateway');
    expect(JSON.stringify(elements)).toContain('menu:commands');
  });

  test('gateway and command menu cards expose second-level content', () => {
    const gateway = createGatewayMenuCard().card as any;
    const commands = createCommandMenuCard().card as any;

    expect(gateway.header.title.content).toBe('Gateway');
    expect(JSON.stringify(gateway.body.elements)).toContain('menu:commands');
    expect(commands.header.title.content).toBe('指令菜单');
    expect(commands.body.elements.some((element: any) => element.tag === 'table')).toBe(true);
  });
});
