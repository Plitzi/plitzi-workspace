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
  packageManager: 'npm',
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

  /**
   * The dev tools render into a shadow root, which cannot see the page's styles.
   *
   * The SDK's built-in default is an absolute `/plitzi-sdk-devtools.css`, which exists only on a server serving
   * the SDK's own assets — so a browser-rendered project got the panel with no styling at all until it was handed
   * a URL of its own.
   */
  it('gives the dev tools a stylesheet the browser project actually serves', () => {
    const files = scaffold(answers({ mode: 'client' }));

    // Served at the path the SDK's own default asks for, from where the SDK is installed — so it cannot go stale
    // and nothing is copied into the project.
    expect(files['vite.config.ts']).toContain('/plitzi-sdk-devtools.css');
    expect(files['vite.config.ts']).toContain('require.resolve(\'@plitzi/plitzi-sdk/plitzi-sdk-devtools.css\')');
    expect(files['vite.config.ts']).toContain('apply: \'serve\'');
    // Without it the entry does not typecheck: CSS side-effect imports and `import.meta.env` are its declarations.
    expect(files['tsconfig.json']).toContain('vite/client');
  });

  /**
   * Every command the project quotes is one its owner can paste.
   *
   * A scaffold that prints `npm install` at somebody who works in Yarn does not merely read wrong — it is how a
   * project ends up with two lockfiles, and the second one is the one nobody notices.
   */
  it('speaks the package manager it was asked for, everywhere it says a command', () => {
    const files = scaffold(answers({ packageManager: 'yarn' }));

    expect(files['README.md']).toContain('yarn install');
    expect(files['README.md']).toContain('yarn visual');
    expect(files['README.md']).not.toContain('npm ');
    // Playwright starts the project itself, so this is the one place a wrong name fails rather than misleads.
    expect(files['playwright.config.ts']).toContain('command: \'yarn start\'');
  });

  it('gives npm the `run` its scripts need, and pnpm the short form', () => {
    expect(scaffold(answers({ packageManager: 'npm' }))['README.md']).toContain('npm run visual');
    expect(scaffold(answers({ packageManager: 'pnpm' }))['README.md']).toContain('pnpm visual');
  });

  /**
   * Yarn installs Plug'n'Play by default and a server-mode project cannot start under it: `node --import tsx`
   * fails to resolve its own entry. The linker is pinned so all three managers produce a project that runs.
   */
  it('pins Yarn to the layout the other two already give it', () => {
    expect(scaffold(answers({ packageManager: 'yarn' }))['.yarnrc.yml']).toBe('nodeLinker: node-modules\n');
    expect(scaffold(answers({ packageManager: 'yarn' }))['.gitignore']).toContain('.yarn/*');
    expect(scaffold(answers({ packageManager: 'npm' }))['.yarnrc.yml']).toBeUndefined();
  });

  /** The space is named after the project, and the url it derives every id from has to stay a DNS label. */
  it('names the space after the project, slugging what ids are derived from', () => {
    const source = scaffold(answers({ name: 'My Site' }))['src/space.ts'];

    expect(source).toContain('name: \'My Site\'');
    expect(source).toContain('permanentUrl: \'my-site\'');
    expect(source).not.toContain('New space');
  });

  /**
   * The one fact about Plitzi a page of built-in elements cannot show.
   *
   * The catalogue covers a page; it does not cover whatever this particular product is about. That gap is closed
   * by a React component and a line of registration, and a project with no example of it leaves people assuming
   * the catalogue is the ceiling — so the scaffold ships one, hosted by the space and rendered on the page.
   */
  it('carries a plugin of the project\'s own, hosted by the space', () => {
    const files = scaffold(answers());

    expect(files['src/plugins/StatCard/StatCard.tsx']).toContain('export interface StatCardProps');
    expect(files['src/plugins/StatCard/index.ts']).toContain('export default StatCard');
    expect(files['src/plugins/README.md']).toContain('renderType');
    // The element that renders it, and the attributes that reach the component as props.
    expect(files['src/space.ts']).toContain('renderType: \'statCard\'');
    expect(files['src/space.ts']).toContain('"label":"Requests today"');
  });

  /**
   * `compile` is what makes a server-mode plugin part of the HTML rather than something hydration adds later.
   * The browser build has no server to compile anything, so it registers the component it already bundles.
   */
  it('registers the plugin the way each mode can actually render it', () => {
    const server = scaffold(answers())['src/main.ts'];
    const client = scaffold(answers({ mode: 'client' }))['src/main.ts'];

    expect(server).toContain('action: \'compile\' as const');
    expect(server).toContain('plugins/StatCard/index.ts');
    expect(client).toContain('const plugins = { statCard: { component: StatCard } };');
    expect(client).toContain('import StatCard from \'./plugins/StatCard\';');
  });

  /**
   * The server compiles plugins into `.sdk-plugins/` and then imports what it built, so a bare `--watch` sees its
   * own output land, restarts, compiles again, and never stops.
   */
  it('watches only the source in server mode, and ignores the build it makes', () => {
    const server = JSON.parse(scaffold(answers())['package.json']) as { scripts: Record<string, string> };

    expect(server.scripts['start:dev']).toContain('--watch-path=./src');
    expect(scaffold(answers())['.gitignore']).toContain('.sdk-plugins');
    expect(scaffold(answers({ mode: 'client' }))['.gitignore']).not.toContain('.sdk-plugins');
  });

  /** One answer to "how should this be laid out", and no fight between the two tools on save. */
  it('formats and lints itself, with Prettier owning layout', () => {
    const files = scaffold(answers());
    const { scripts, devDependencies } = JSON.parse(files['package.json']) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(scripts.lint).toBe('eslint .');
    expect(scripts.format).toBe('prettier --write .');
    expect(devDependencies.prettier).toBeTruthy();
    expect(devDependencies['typescript-eslint']).toBeTruthy();
    // Last in the config, so it can switch off the stylistic rules the earlier entries turned on.
    expect(files['eslint.config.mjs'].trimEnd().endsWith('eslintConfigPrettier\n);')).toBe(true);
    expect(JSON.parse(files['.prettierrc'])).toMatchObject({ printWidth: 120, singleQuote: true });
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
      // Named explicitly: the default is read off whatever invoked the test run, and Yarn writes a file npm does not.
      await create(target, { install: false, packageManager: 'npm' });

      const written = await fs.readdir(target);
      expect(written.sort()).toEqual([
        '.claude',
        '.gitignore',
        '.prettierignore',
        '.prettierrc',
        'README.md',
        'eslint.config.mjs',
        'package.json',
        'playwright.config.ts',
        'src',
        'tsconfig.json',
        'visual'
      ]);
      expect((await fs.readdir(path.join(target, 'src'))).sort()).toEqual([
        'author.ts',
        'main.ts',
        'plugins',
        'space.ts'
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
