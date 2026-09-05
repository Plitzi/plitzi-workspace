import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import create from './create';
import { scaffold } from '../scaffold';

import type { CreateAnswers } from '../scaffold';

/**
 * The scaffold is a promise about the first five minutes: install, start, see a page. What is asserted is the
 * shape somebody depends on — the files exist, the space is theirs to edit, a secret is only ever in the file
 * git ignores, and a directory with work in it is never written over.
 */

const answers = (over: Partial<CreateAnswers> = {}): CreateAnswers => ({
  name: 'demo',
  mode: 'server',
  source: 'local',
  key: '',
  environment: 'main',
  ...over
});

const inTemp = async (run: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-cli-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

describe('the scaffold', () => {
  it('gives a local project the space as its own source', () => {
    const files = scaffold(answers());

    expect(files['src/space.ts']).toContain('from \'@plitzi/sdk-authoring\'');
    expect(files['src/space.ts']).toContain('name: \'demo\'');
    // Relative imports would resolve to nothing outside the package the copy came from.
    expect(files['src/space.ts']).not.toMatch(/from '\.\./);
  });

  it('gives a cloud project no space, and reads the live one instead', () => {
    const files = scaffold(answers({ source: 'cloud', key: 'k' }));

    expect(files['src/space.ts']).toBeUndefined();
    expect(files['src/main.ts']).toContain('createCloudAdapters');
  });

  it('renders on a server or in the browser, and says so in what it installs', () => {
    const server = JSON.parse(scaffold(answers())['package.json']) as {
      dependencies: Record<string, string>;
    };
    const client = JSON.parse(scaffold(answers({ mode: 'client' }))['package.json']) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(server.dependencies['@plitzi/sdk-server']).toBeTruthy();
    expect(client.dependencies['@plitzi/plitzi-sdk']).toBeTruthy();
    expect(client.scripts.start).toBe('vite');
  });

  /** The loop the client mode exists for: a save updates the page without reloading it. */
  it('accepts the space module for hot replacement in the browser', () => {
    const files = scaffold(answers({ mode: 'client' }));

    expect(files['src/main.ts']).toContain('import.meta.hot.accept(\'./space\'');
    expect(files['src/main.ts']).toContain('mounted?.unmount()');
  });

  it('carries the authoring skill for whatever agent opens the project', () => {
    expect(scaffold(answers())['.claude/skills/plitzi-authoring/SKILL.md']).toContain('---');
  });

  /** Vite binds `localhost`, which is IPv6 here, while everything waiting for a dev server asks 127.0.0.1. */
  it('pins the dev server to the address its own tests wait on', () => {
    const files = scaffold(answers({ mode: 'client' }));

    expect(files['vite.config.ts']).toContain('host: \'127.0.0.1\'');
    expect(files['playwright.config.ts']).toContain('127.0.0.1');
  });
});

describe('plitzi create', () => {
  it('writes a project that can be installed and started', async () => {
    await inTemp(async dir => {
      const target = path.join(dir, 'my-site');
      await create(target, { install: false });

      const written = await fs.readdir(target);
      expect(written.sort()).toEqual([
        '.claude',
        '.gitignore',
        'README.md',
        'package.json',
        'playwright.config.ts',
        'src',
        'tsconfig.json',
        'visual'
      ]);
    });
  });

  /** The whole reason a key goes in a file of its own: the file it goes in is the one git is told to skip. */
  it('puts a cloud key in .env, and .env in .gitignore', async () => {
    await inTemp(async dir => {
      await create(dir, { source: 'cloud', key: 'host_key_123', install: false, force: true });

      expect(await fs.readFile(path.join(dir, '.env'), 'utf-8')).toContain('PLITZI_HOST_KEY=host_key_123');
      expect(await fs.readFile(path.join(dir, '.gitignore'), 'utf-8')).toContain('.env');
      expect(await fs.readFile(path.join(dir, 'src', 'main.ts'), 'utf-8')).not.toContain('host_key_123');
    });
  });

  /** Somebody's existing work is not a directory to write ten files into on the strength of a typo'd path. */
  it('refuses a directory that is not empty', async () => {
    await inTemp(async dir => {
      await fs.writeFile(path.join(dir, 'something.txt'), 'mine');
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await create(dir, { install: false });

      expect(error).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      await expect(fs.readFile(path.join(dir, 'package.json'), 'utf-8')).rejects.toThrow();

      error.mockRestore();
      process.exitCode = 0;
    });
  });
});
