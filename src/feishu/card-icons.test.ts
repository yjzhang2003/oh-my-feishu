import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const documentedFallbackTokens = [
  'add_outlined',
  'chatbox_outlined',
  'check_outlined',
  'code_outlined',
  'command_outlined',
  'connect_outlined',
  'details_outlined',
  'doc-search_outlined',
  'edit_outlined',
  'folder_outlined',
  'history_outlined',
  'info_outlined',
  'left_outlined',
  'link-copy_outlined',
  'local_outlined',
  'plugin_outlined',
  'refresh_outlined',
  'robot_outlined',
  'search_outlined',
  'send_outlined',
  'status-meeting_outlined',
  'stop_outlined',
  'time_outlined',
  'version_outlined',
  'warning_outlined',
];

function walkTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkTypeScriptFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('Feishu card icons', () => {
  test('all standard icon tokens used in source exist in docs icon library', () => {
    const iconDocPath = join(rootDir, 'docs/图标库.md');
    const documentedTokens = existsSync(iconDocPath)
      ? new Set(
        [...readFileSync(iconDocPath, 'utf8').matchAll(/\|\s*([a-z0-9][a-z0-9_-]+_(?:outlined|filled))\s*\|/g)]
          .map((match) => match[1])
      )
      : new Set(documentedFallbackTokens);

    const usedTokens = new Map<string, Set<string>>();
    for (const file of walkTypeScriptFiles(join(rootDir, 'src'))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/['"]([a-z0-9][a-z0-9_-]+_(?:outlined|filled))['"]/g)) {
          const token = match[1];
          const locations = usedTokens.get(token) ?? new Set<string>();
          locations.add(`${relative(rootDir, file)}:${index + 1}`);
          usedTokens.set(token, locations);
        }
      });
    }

    const missing = [...usedTokens.entries()]
      .filter(([token]) => !documentedTokens.has(token))
      .map(([token, locations]) => `${token}: ${[...locations].join(', ')}`)
      .sort();

    expect(missing).toEqual([]);
  });
});
