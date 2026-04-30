import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from './session-store.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  afterEach(() => {
    store.destroy();
  });

  test('get returns default state for unknown chatId', () => {
    const state = store.get('unknown-chat');
    expect(state.chatId).toBe('unknown-chat');
    expect(state.flow).toBe('none');
    expect(state.data).toEqual({});
  });

  test('set updates session state', () => {
    store.set('chat-1', { flow: 'service-add-step1' });
    const state = store.get('chat-1');
    expect(state.flow).toBe('service-add-step1');
  });

  test('set preserves other fields', () => {
    store.set('chat-1', { flow: 'service-add-step1', data: { name: 'test' } });
    const state = store.get('chat-1');
    expect(state.flow).toBe('service-add-step1');
    expect(state.data).toEqual({ name: 'test' });
  });

  test('clear removes session', () => {
    store.set('chat-1', { flow: 'service-add-step1' });
    store.clear('chat-1');
    const state = store.get('chat-1');
    expect(state.flow).toBe('none');
  });

});
