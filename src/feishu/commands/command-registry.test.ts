import { describe, test, expect } from 'vitest';
import { CommandRegistry } from './command-registry.js';
import type { CommandHandler } from './types.js';

describe('CommandRegistry', () => {
  const mockHandler: CommandHandler = {
    name: '/test',
    description: 'Test command',
    async execute() {},
  };

  test('registers a command handler', () => {
    const registry = new CommandRegistry();
    registry.register(mockHandler);
    expect(registry.find('/test')).toBe(mockHandler);
  });

  test('registers command with aliases', () => {
    const registry = new CommandRegistry();
    const handler = { ...mockHandler, aliases: ['/t', '/te'] };
    registry.register(handler);
    expect(registry.find('/test')?.name).toBe('/test');
    expect(registry.find('/t')?.name).toBe('/test');
    expect(registry.find('/te')?.name).toBe('/test');
  });

  test('find returns undefined for unknown command', () => {
    const registry = new CommandRegistry();
    expect(registry.find('/unknown')).toBeUndefined();
  });

  test('list returns unique handlers (dedupes aliases)', () => {
    const registry = new CommandRegistry();
    const handlerWithAlias = { ...mockHandler, aliases: ['/alias'] };
    registry.register(handlerWithAlias);
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('/test');
  });

  test('list returns all unique handlers', () => {
    const registry = new CommandRegistry();
    registry.register(mockHandler);
    registry.register({ name: '/other', description: 'Other', async execute() {} });
    const list = registry.list();
    expect(list).toHaveLength(2);
  });
});
