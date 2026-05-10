import { delimiter } from 'path';
import { basename, dirname, join } from 'path';
import { createRequire } from 'module';
import { PACKAGE_ROOT } from '../config/paths.js';

const requireFromPackage = createRequire(join(PACKAGE_ROOT, 'package.json'));

function pathDelimiterFor(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : delimiter;
}

export function packageBinDir(packageRoot: string = PACKAGE_ROOT): string {
  return join(packageRoot, 'node_modules', '.bin');
}

export function packageBinDirs(packageRoot: string = PACKAGE_ROOT): string[] {
  const dirs = [packageBinDir(packageRoot)];
  const parentDir = dirname(packageRoot);
  if (basename(parentDir) === 'node_modules') {
    dirs.push(join(parentDir, '.bin'));
  }
  return Array.from(new Set(dirs));
}

export function resolvePackageBin(
  name: string,
  packageRoot: string = PACKAGE_ROOT,
  platform: NodeJS.Platform = process.platform
): string {
  return join(packageBinDir(packageRoot), platform === 'win32' ? `${name}.cmd` : name);
}

export function resolvePm2Bin(packageRoot: string = PACKAGE_ROOT): string {
  try {
    return requireFromPackage.resolve('pm2/bin/pm2', { paths: [packageRoot] });
  } catch {
    // Fall back to the nested dependency layout used by some npm installs.
  }
  return join(packageRoot, 'node_modules', 'pm2', 'bin', 'pm2');
}

export function resolveLarkCliBin(packageRoot: string = PACKAGE_ROOT): string {
  try {
    return requireFromPackage.resolve('@larksuite/cli/scripts/run.js', { paths: [packageRoot] });
  } catch {
    // Fall back to npm's generated bin shim when direct package resolution fails.
  }
  return resolvePackageBin('lark-cli', packageRoot);
}

export function buildToolPathEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  packageRoot: string = PACKAGE_ROOT,
  platform: NodeJS.Platform = process.platform
): NodeJS.ProcessEnv {
  const pathKey = Object.keys(baseEnv).find((key) => key.toLowerCase() === 'path') || 'PATH';
  const currentPath = baseEnv[pathKey];
  const pathDelimiter = pathDelimiterFor(platform);
  const toolPath = packageBinDirs(packageRoot).join(pathDelimiter);

  return {
    ...baseEnv,
    [pathKey]: currentPath ? `${toolPath}${pathDelimiter}${currentPath}` : toolPath,
  };
}
