import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  homeDir: '',
}));

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: () => hoisted.homeDir || actual.homedir(),
  };
});

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 1, stdout: '' }),
}));

describe('listSessions', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'oh-my-feishu-claude-home-'));
    hoisted.homeDir = tempHome;
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
    hoisted.homeDir = '';
  });

  it('lists Claude Code sessions from local project jsonl files by recency', async () => {
    const { listSessions } = await import('./invoker.js');
    const directory = join(tempHome, 'workspace', 'demo-project');
    const projectDir = join(tempHome, '.claude', 'projects', resolve(directory).replace(/\\/g, '-').replace(/\//g, '-'));
    mkdirSync(projectDir, { recursive: true });

    writeFileSync(join(projectDir, 'older-session.jsonl'), [
      JSON.stringify({ type: 'user', sessionId: 'older-session', cwd: directory, timestamp: '2026-04-30T10:00:00.000Z' }),
      JSON.stringify({ type: 'last-prompt', lastPrompt: '修复目录会话恢复', sessionId: 'older-session' }),
      JSON.stringify({ type: 'assistant', sessionId: 'older-session', cwd: directory, timestamp: '2026-04-30T10:05:00.000Z' }),
    ].join('\n'));
    writeFileSync(join(projectDir, 'newer-session.jsonl'), [
      JSON.stringify({ type: 'user', sessionId: 'newer-session', cwd: directory, timestamp: '2026-05-01T10:00:00.000Z' }),
      JSON.stringify({ type: 'custom-title', customTitle: 'gateway-menu-polish', sessionId: 'newer-session' }),
      '{bad json',
    ].join('\n'));

    const oldTime = new Date('2026-04-30T10:05:00.000Z');
    const newTime = new Date('2026-05-01T10:00:00.000Z');
    await import('fs').then((fs) => {
      fs.utimesSync(join(projectDir, 'older-session.jsonl'), oldTime, oldTime);
      fs.utimesSync(join(projectDir, 'newer-session.jsonl'), newTime, newTime);
    });

    await expect(listSessions(directory)).resolves.toEqual([
      { id: 'newer-session', lastActive: '2026-05-01T10:00:00.000Z', summary: 'gateway-menu-polish' },
      { id: 'older-session', lastActive: '2026-04-30T10:05:00.000Z', summary: '修复目录会话恢复' },
    ]);
  });
});
