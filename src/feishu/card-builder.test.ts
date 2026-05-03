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
  createDirectorySessionSelectCard,
  createGatewayMenuCard,
  createMainMenuCard,
  createSessionHistoryCard,
  createWebMonitorDetailCard,
  createWebMonitorInputCard,
  createWebMonitorMenuCard,
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

  test('automation skill and command menu cards expose second-level content', () => {
    const gateway = createGatewayMenuCard().card as any;
    const commands = createCommandMenuCard().card as any;

    expect(gateway.header.title.content).toBe('自动化技能');
    expect(JSON.stringify(gateway.body.elements)).toContain('Web 服务监控');
    expect(JSON.stringify(gateway.body.elements)).toContain('menu:gateway-web-monitor');
    expect(JSON.stringify(gateway)).not.toContain('menu:commands');
    expect(JSON.stringify(gateway)).not.toContain('Gateway');
    expect(commands.header.title.content).toBe('指令菜单');
    expect(commands.body.elements.some((element: any) => element.tag === 'table')).toBe(true);
    expect(JSON.stringify(commands)).not.toContain('oh-my-feishu gateway');
    expect(JSON.stringify(commands)).not.toContain('menu:gateway');
  });

  test('web monitor menu card exposes monitor actions', () => {
    const webMonitor = createWebMonitorMenuCard([]).card as any;
    const cardJson = JSON.stringify(webMonitor);

    expect(webMonitor.header.title.content).toBe('Web 服务监控');
    expect(cardJson).toContain('menu:web-monitor-new');
    expect(cardJson).toContain('menu:gateway');
    expect(cardJson).not.toContain('menu:commands');
  });

  test('web monitor menu card uses interactive service entries instead of tables', () => {
    const { card } = createWebMonitorMenuCard([{
      name: 'api',
      githubOwner: 'org',
      githubRepo: 'api',
      localRepoPath: '/tmp/workspace/services/api',
      tracebackUrl: 'https://logs.example.com/api',
      notifyChatId: 'oc_test',
      tracebackUrlType: 'json',
      enabled: true,
      addedAt: '2026-05-01T10:00:00.000Z',
      addedBy: 'ou_test',
    }]);
    const elements = ((card as any).body.elements ?? []) as any[];
    const cardJson = JSON.stringify(card);

    expect(elements.some((element) => element.tag === 'table')).toBe(false);
    expect(elements.some((element) => element.tag === 'interactive_container')).toBe(true);
    expect(cardJson).toContain('menu:web-monitor-detail:api');
  });

  test('web monitor detail card exposes service actions', () => {
    const { card } = createWebMonitorDetailCard({
      name: 'api',
      githubOwner: 'org',
      githubRepo: 'api',
      localRepoPath: '/tmp/workspace/services/api',
      tracebackUrl: 'https://logs.example.com/api',
      notifyChatId: 'oc_test',
      tracebackUrlType: 'json',
      enabled: true,
      addedAt: '2026-05-01T10:00:00.000Z',
      addedBy: 'ou_test',
      lastTracebackPreview: 'Traceback...',
      lastClaudeRunAt: '2026-05-01T10:05:00.000Z',
      lastClaudeRunSuccess: true,
      lastClaudeRunSummary: 'fixed',
    });
    const cardJson = JSON.stringify(card);
    const elements = ((card as any).body.elements ?? []) as any[];

    expect(cardJson).toContain('menu:web-monitor-session:api');
    expect(cardJson).toContain('menu:web-monitor-delete:api');
    expect(cardJson).toContain('Traceback...');
    expect(cardJson).toContain('fixed');
    expect(elements.slice(0, 7).every((element) => element.tag === 'interactive_container')).toBe(true);
    expect(elements.some((element) => (
      element.tag === 'interactive_container'
      && JSON.stringify(element).includes('最近一次 Claude Code 介入')
    ))).toBe(true);
  });

  test('web monitor input card contains required form fields', () => {
    const card = createWebMonitorInputCard() as any;
    const cardJson = JSON.stringify(card);

    expect(card.header.title.content).toBe('新建监控');
    expect(cardJson).toContain('"name":"wm_form"');
    expect(cardJson).toContain('"name":"wm_name"');
    expect(cardJson).toContain('"name":"wm_repo"');
    expect(cardJson).toContain('"name":"wm_url"');
    expect(cardJson).toContain('"name":"wm_auto_pr"');
    expect(cardJson).toContain('"name":"wm_pr_base"');
    expect(cardJson).toContain('"name":"wm_pr_mode"');
    expect(cardJson).toContain('"name":"wm_pr_branch_prefix"');
    expect(cardJson).toContain('"form_action_type":"submit"');
  });

  test('directory session select card uses interactive options instead of tables', () => {
    const { card } = createDirectorySessionSelectCard('/tmp/project', [
      { id: '11111111-1111-4111-8111-111111111111', lastActive: '2026-05-01T10:00:00.000Z', summary: '修复菜单交互' },
      { id: '22222222-2222-4222-8222-222222222222', lastActive: '2026-05-01T09:00:00.000Z', summary: '优化 README' },
    ]);
    const elements = ((card as any).body.elements ?? []) as any[];
    const cardJson = JSON.stringify(card);

    expect(elements.some((element) => element.tag === 'table')).toBe(false);
    expect(elements.filter((element) => element.tag === 'interactive_container')).toHaveLength(2);
    expect(cardJson).toContain('session:select:11111111-1111-4111-8111-111111111111');
    expect(cardJson).toContain('修复菜单交互');
  });

  test('session history card uses interactive entries and keeps detail navigation', () => {
    const { card } = createSessionHistoryCard([
      {
        directory: '/tmp/project-a',
        sessionId: '11111111-1111-4111-8111-111111111111',
        lastUsed: '2026-05-01T10:00:00.000Z',
      },
      {
        directory: '/tmp/project-b',
        sessionId: null,
        lastUsed: '2026-05-01T09:00:00.000Z',
      },
    ]);
    const elements = ((card as any).body.elements ?? []) as any[];
    const cardJson = JSON.stringify(card);

    expect(elements.some((element) => element.tag === 'table')).toBe(false);
    expect(elements.filter((element) => element.tag === 'interactive_container')).toHaveLength(2);
    expect(cardJson).toContain('menu:detail:0');
    expect(cardJson).toContain('project-a');
  });
});
