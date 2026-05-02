import { describe, expect, it, vi } from 'vitest';
import { execa } from 'execa';
import { install } from '../marketplace/index.js';
import { cloneServiceRepository, githubHttpsUrl, serviceRepoPath } from './repository.js';

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' }),
}));

vi.mock('../marketplace/index.js', () => ({
  install: vi.fn().mockResolvedValue(undefined),
}));

describe('service repository helpers', () => {
  it('builds GitHub HTTPS clone URLs', () => {
    expect(githubHttpsUrl('org', 'api')).toBe('https://github.com/org/api.git');
  });

  it('shallow clones service repository and installs plugin', async () => {
    const targetDir = await cloneServiceRepository({
      serviceName: 'test-service-repo',
      owner: 'org',
      repo: 'api',
    });

    expect(targetDir).toBe(serviceRepoPath('test-service-repo'));
    expect(execa).toHaveBeenCalledWith('git', [
      'clone',
      '--depth',
      '1',
      'https://github.com/org/api.git',
      serviceRepoPath('test-service-repo'),
    ], expect.objectContaining({
      reject: false,
    }));
    expect(install).toHaveBeenCalledWith({ targetDir: serviceRepoPath('test-service-repo') });
  });
});
