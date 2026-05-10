import { describe, expect, it } from 'vitest';
import { join } from 'path';
import {
  buildToolPathEnv,
  packageBinDir,
  packageBinDirs,
  resolvePackageBin,
  resolvePm2Bin,
  resolveLarkCliBin,
} from './tool-paths.js';

describe('tool path helpers', () => {
  it('resolves package-managed pm2 and lark-cli bins from the package root', () => {
    const root = '/tmp/oh-my-feishu';

    expect(resolvePm2Bin(root)).toBe(join(root, 'node_modules', 'pm2', 'bin', 'pm2'));
    expect(resolveLarkCliBin(root)).toBe(join(root, 'node_modules', '.bin', 'lark-cli'));
    expect(resolvePackageBin('example', root)).toBe(join(root, 'node_modules', '.bin', 'example'));
  });

  it('appends .cmd on Windows package bin resolution', () => {
    const root = 'C:\\oh-my-feishu';

    expect(resolvePackageBin('lark-cli', root, 'win32')).toBe(join(root, 'node_modules', '.bin', 'lark-cli.cmd'));
  });

  it('prepends the package .bin directory to PATH-compatible env vars', () => {
    const root = '/tmp/oh-my-feishu';
    const env = buildToolPathEnv({ PATH: '/usr/bin' }, root, 'linux');

    expect(env.PATH?.split(':')[0]).toBe(packageBinDir(root));
    expect(env.PATH).toContain('/usr/bin');
  });

  it('includes the parent node_modules .bin directory for hoisted npm installs', () => {
    const root = '/tmp/install/node_modules/oh-my-feishu';

    expect(packageBinDirs(root)).toEqual([
      join(root, 'node_modules', '.bin'),
      '/tmp/install/node_modules/.bin',
    ]);
  });
});
