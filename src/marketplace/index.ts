/**
 * Marketplace
 * Main entry point for plugin management
 * Uses official Claude Code plugin marketplace system
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { log } from '../utils/logger.js';

// Resolve REPO_ROOT from the package location (where this module resides)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

export interface MarketplaceOptions {
  targetDir: string;
}

const MARKETPLACE_NAME = 'oh-my-feishu-marketplace';
const PLUGIN_NAME = 'oh-my-feishu';

/**
 * Install the oh-my-feishu plugin into a target directory
 * Uses official `claude plugin marketplace add` + `claude plugin install`
 */
export async function install(options: MarketplaceOptions): Promise<void> {
  const marketplaceSource = REPO_ROOT;

  try {
    // Add marketplace from local repo path (project scope)
    await execa('claude', [
      'plugin', 'marketplace', 'add',
      marketplaceSource,
      '--scope', 'project',
    ], {
      cwd: options.targetDir,
      timeout: 30000,
      reject: false,
    });

    // Install the plugin
    const result = await execa('claude', [
      'plugin', 'install',
      `${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
      '--scope', 'project',
    ], {
      cwd: options.targetDir,
      timeout: 30000,
      reject: false,
    });

    if (result.exitCode === 0) {
      log.info('marketplace', 'Plugin installed via official marketplace', { targetDir: options.targetDir });
    } else {
      log.warn('marketplace', 'Plugin install via CLI failed, falling back to direct copy', {
        stderr: result.stderr?.slice(0, 200),
      });
      // Fallback: direct file copy
      installDirect(options);
    }
  } catch (error) {
    log.warn('marketplace', 'Marketplace install error, falling back to direct copy', { error: String(error) });
    installDirect(options);
  }
}

/**
 * Fallback: directly copy skill files to target directory
 */
function installDirect(options: MarketplaceOptions): void {
  const { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');

  const claudeDir = join(options.targetDir, '.claude');
  const settingsPath = join(claudeDir, 'settings.json');
  const skillsSourceDir = resolve(REPO_ROOT, 'oh-my-feishu-plugin', 'skills');

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  // Copy all skill directories
  const targetSkillsDir = join(claudeDir, 'skills');
  if (existsSync(skillsSourceDir)) {
    cpSync(skillsSourceDir, targetSkillsDir, { recursive: true });
    log.info('marketplace', 'Skills copied directly', { to: targetSkillsDir });
  }

  // Update settings.json
  const { readdirSync } = require('fs') as typeof import('fs');
  const skills = existsSync(skillsSourceDir)
    ? readdirSync(skillsSourceDir, { withFileTypes: true })
        .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
        .map((d: { name: string }) => d.name)
    : [];

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch { /* ignore */ }
  }

  const plugins = (settings.plugins || {}) as Record<string, unknown>;
  plugins[PLUGIN_NAME] = { version: '1.0.0', skills };
  settings.plugins = plugins;

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  log.info('marketplace', 'Plugin installed via direct copy', { dir: settingsPath });
}
