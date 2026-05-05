import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const PACKAGE_ROOT = resolve(__dirname, '../..');

// Check if running from npm global install (dist is inside node_modules)
function isNpmGlobalInstall(): boolean {
  return PACKAGE_ROOT.includes('node_modules');
}

// User data directory for npm installs, package directory for development
function getDefaultRepoRoot(): string {
  // If REPO_ROOT is set, use it
  if (process.env.REPO_ROOT) {
    return process.env.REPO_ROOT;
  }

  // If running from npm global install, use ~/.oh-my-feishu
  if (isNpmGlobalInstall()) {
    return join(homedir(), '.oh-my-feishu');
  }

  // Otherwise use package directory (development/local clone)
  return PACKAGE_ROOT;
}

export function getRepoRoot(): string {
  return getDefaultRepoRoot();
}

export function getWorkspaceDir(): string {
  return resolve(getRepoRoot(), 'workspace');
}

// Ensure workspace directories exist
export function ensureWorkspaceDirs(): void {
  const workspaceDir = getWorkspaceDir();
  const dirs = [
    workspaceDir,
    resolve(workspaceDir, '.claude'),
    resolve(workspaceDir, '.claude', 'triggers'),
    resolve(workspaceDir, 'services'),
    resolve(getRepoRoot(), 'logs'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
