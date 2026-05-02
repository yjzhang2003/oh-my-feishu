import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PACKAGE_ROOT = resolve(__dirname, '../..');

export function getRepoRoot(): string {
  return process.env.REPO_ROOT || PACKAGE_ROOT;
}

export function getWorkspaceDir(): string {
  return resolve(getRepoRoot(), 'workspace');
}
