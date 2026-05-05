import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

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
    const iconDoc = readFileSync(join(rootDir, 'docs/图标库.md'), 'utf8');
    const documentedTokens = new Set(
      [...iconDoc.matchAll(/\|\s*([a-z0-9][a-z0-9_-]+_(?:outlined|filled))\s*\|/g)]
        .map((match) => match[1])
    );

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
