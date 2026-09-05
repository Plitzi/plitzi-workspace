import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import init from './init';
import { scaffold } from './scaffold';

/**
 * The scaffold is a promise about the first five minutes: install, start, see a page. So what is asserted is the
 * shape somebody actually depends on — the files exist, the secret is in the one that is ignored, and a directory
 * with work in it is never written over.
 */

const inTemp = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-cli-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

describe('plitzi init', () => {
  it('writes a project that can be installed and started', async () => {
    await inTemp(async dir => {
      const target = path.join(dir, 'my-site');
      await init(target, { key: 'host_key_123' });

      const written = await fs.readdir(target);
      expect(written.sort()).toEqual(['.env', '.gitignore', 'README.md', 'package.json', 'src', 'tsconfig.json']);

      const manifest = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf-8')) as {
        name: string;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
      };

      expect(manifest.name).toBe('my-site');
      expect(manifest.scripts.start).toContain('src/main.ts');
      expect(manifest.dependencies['@plitzi/sdk-server']).toBeTruthy();
    });
  });

  /** The whole reason the key goes in a file of its own: the file it goes in is the one git is told to skip. */
  it('puts the key in .env, and .env in .gitignore', async () => {
    await inTemp(async dir => {
      await init(dir, { key: 'host_key_123', force: true });

      expect(await fs.readFile(path.join(dir, '.env'), 'utf-8')).toContain('PLITZI_HOST_KEY=host_key_123');
      expect(await fs.readFile(path.join(dir, '.gitignore'), 'utf-8')).toContain('.env');
      expect(await fs.readFile(path.join(dir, 'src', 'main.ts'), 'utf-8')).not.toContain('host_key_123');
    });
  });

  it('serves the environment it was told to', async () => {
    await inTemp(async dir => {
      await init(dir, { key: 'k', environment: 'production', force: true });

      expect(await fs.readFile(path.join(dir, '.env'), 'utf-8')).toContain('PLITZI_ENVIRONMENT=production');
    });
  });

  /** Somebody's existing work is not a directory to write six files into on the strength of a typo'd path. */
  it('refuses a directory that is not empty', async () => {
    await inTemp(async dir => {
      await fs.writeFile(path.join(dir, 'something.txt'), 'mine');
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await init(dir, { key: 'k' });

      expect(error).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      await expect(fs.readFile(path.join(dir, 'package.json'), 'utf-8')).rejects.toThrow();

      error.mockRestore();
      process.exitCode = 0;
    });
  });

  it('never writes a key it was not given', () => {
    const files = scaffold({ name: 'x', key: '', environment: 'main' });

    expect(files['.env']).toContain('PLITZI_HOST_KEY=\n');
  });
});
