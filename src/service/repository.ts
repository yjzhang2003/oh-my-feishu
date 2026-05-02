import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { execa } from 'execa';
import { getWorkspaceDir } from '../config/paths.js';
import { install as installMarketplace } from '../marketplace/index.js';

const SERVICES_DIR = resolve(getWorkspaceDir(), 'services');

export function serviceRepoPath(serviceName: string): string {
  return resolve(SERVICES_DIR, sanitizeServiceName(serviceName));
}

export function githubHttpsUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

export async function cloneServiceRepository(input: {
  serviceName: string;
  owner: string;
  repo: string;
}): Promise<string> {
  const targetDir = serviceRepoPath(input.serviceName);
  if (existsSync(targetDir)) {
    throw new Error(`Local service repository already exists: ${targetDir}`);
  }

  const result = await execa('git', [
    'clone',
    '--depth',
    '1',
    githubHttpsUrl(input.owner, input.repo),
    targetDir,
  ], {
    timeout: 120000,
    reject: false,
    stdin: 'ignore',
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `git clone failed with exit ${result.exitCode}`);
  }

  await installMarketplace({ targetDir });
  return targetDir;
}

export function removeServiceRepository(serviceName: string): void {
  const targetDir = serviceRepoPath(serviceName);
  if (!isInsideServicesDir(targetDir)) {
    throw new Error(`Refusing to remove path outside services workspace: ${targetDir}`);
  }
  rmSync(targetDir, { recursive: true, force: true });
}

function sanitizeServiceName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '-');
}

function isInsideServicesDir(targetDir: string): boolean {
  const normalizedServicesDir = resolve(SERVICES_DIR);
  const normalizedTarget = resolve(targetDir);
  return normalizedTarget === normalizedServicesDir || normalizedTarget.startsWith(`${normalizedServicesDir}/`);
}
