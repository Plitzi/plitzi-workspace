/* eslint-disable quotes */
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

/** Runs `run` as if a person were at the terminal: vitest's streams are not TTYs, and neither is an agent's shell. */
const atTerminal = async (run: () => Promise<void>): Promise<void> => {
  const stdin = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  const stdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  try {
    await run();
  } finally {
    const restore = (stream: NodeJS.ReadStream | NodeJS.WriteStream, descriptor?: PropertyDescriptor) => {
      if (descriptor) {
        Object.defineProperty(stream, 'isTTY', descriptor);
      } else {
        Reflect.deleteProperty(stream, 'isTTY');
      }
    };
    restore(process.stdin, stdin);
    restore(process.stdout, stdout);
  }
};

describe('the scaffold', () => {
  it('gives a local project the space as its own source', () => {
    const files = scaffold(answers());

    expect(files['src/space.ts']).toContain("from '@plitzi/sdk-authoring'");
    expect(files['src/space.ts']).toContain("name: 'demo'");
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

    expect(files['src/main.ts']).toContain("import.meta.hot.accept('./space'");
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
    expect(files['vite.config.ts']).toContain("require.resolve('@plitzi/plitzi-sdk/plitzi-sdk-devtools.css')");
    expect(files['vite.config.ts']).toContain("apply: 'serve'");
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
    expect(files['playwright.config.ts']).toContain("command: 'yarn start'");
  });

  it('gives npm the `run` its scripts need, and pnpm the short form', () => {
    expect(scaffold(answers({ packageManager: 'npm' }))['README.md']).toContain('npm run visual');
    expect(scaffold(answers({ packageManager: 'pnpm' }))['README.md']).toContain('pnpm visual');
  });

  /**
   * Yarn installs Plug'n'Play by default, and the project runs straight from `node_modules`. The linker is pinned so
   * all three managers produce a project that runs.
   */
  it('pins Yarn to the layout the other two already give it', () => {
    expect(scaffold(answers({ packageManager: 'yarn' }))['.yarnrc.yml']).toContain('nodeLinker: node-modules\n');
    expect(scaffold(answers({ packageManager: 'yarn' }))['.gitignore']).toContain('.yarn/*');
    expect(scaffold(answers({ packageManager: 'npm' }))['.yarnrc.yml']).toBeUndefined();
  });

  /**
   * The first install succeeds on release day, under all three managers.
   *
   * Each was verified failing without these: pnpm stops on the esbuild build it skipped (ERR_PNPM_IGNORED_BUILDS),
   * Yarn quarantines every `@plitzi/*` published in the last day (YN0016), and npm lists unreviewed install scripts
   * it has announced it will start blocking.
   */
  it('lets the first install through under each manager, and exempts only what the CLI ships', () => {
    const yarn = scaffold(answers({ packageManager: 'yarn' }));
    const pnpm = scaffold(answers({ packageManager: 'pnpm' }));
    const npm = JSON.parse(scaffold(answers({ packageManager: 'npm' }))['package.json']) as {
      allowScripts?: Record<string, boolean>;
    };

    expect(yarn['.yarnrc.yml']).toContain('npmPreapprovedPackages:\n  - "@plitzi/*"');
    expect(pnpm['pnpm-workspace.yaml']).toContain('allowBuilds:\n  esbuild: true');
    expect(pnpm['pnpm-workspace.yaml']).toContain("minimumReleaseAgeExclude:\n  - '@plitzi/*'");
    expect(npm.allowScripts).toEqual({ esbuild: true, fsevents: false });
    expect(JSON.parse(pnpm['package.json'])).not.toHaveProperty('allowScripts');
    expect(scaffold(answers({ packageManager: 'npm' }))['pnpm-workspace.yaml']).toBeUndefined();
  });

  /** Verified against Yarn 4.9.4, which refuses the whole `.yarnrc.yml` over a setting it does not know. */
  it('writes the Yarn age-gate exemption only for a Yarn that has the gate', () => {
    const rc = (managerVersion?: string): string =>
      scaffold(answers({ packageManager: 'yarn', managerVersion }))['.yarnrc.yml'];

    expect(rc('4.9.4')).toBe('nodeLinker: node-modules\n');
    expect(rc('4.10.0')).toContain('npmPreapprovedPackages');
    expect(rc('4.17.0')).toContain('npmPreapprovedPackages');
    expect(rc(undefined)).toContain('npmPreapprovedPackages');
  });

  /** The space is named after the project, and the url it derives every id from has to stay a DNS label. */
  it('names the space after the project, slugging what ids are derived from', () => {
    const source = scaffold(answers({ name: 'My Site' }))['src/space.ts'];

    expect(source).toContain("name: 'My Site'");
    expect(source).toContain("permanentUrl: 'my-site'");
    expect(source).not.toContain('New space');
  });

  /**
   * The one fact about Plitzi a page of built-in elements cannot show.
   *
   * The catalogue covers a page; it does not cover whatever this particular product is about. That gap is closed
   * by a React component and a line of registration, and a project with no example of it leaves people assuming
   * the catalogue is the ceiling — so the scaffold ships one, hosted by the space and rendered on the page.
   */
  it("carries a plugin of the project's own, hosted by the space", () => {
    const files = scaffold(answers());

    expect(files['src/plugins/StatCard/StatCard.tsx']).toContain('export interface StatCardProps');
    expect(files['src/plugins/StatCard/index.ts']).toContain('export default StatCard');
    expect(files['src/plugins/README.md']).toContain('renderType');
    // The element that renders it, and the attributes that reach the component as props.
    expect(files['src/space.ts']).toContain("renderType: 'statCard'");
    expect(files['src/space.ts']).toContain("label: 'Requests today'");
  });

  // A client project serves `public/`, so its numbers come from a data file through a provider — never invented.
  it('feeds the plugin from a data file the project serves, in client mode', () => {
    const files = scaffold(answers({ mode: 'client' }));

    expect(JSON.parse(files['public/data/stats.json'])).toMatchObject({ value: 12480 });
    expect(files['src/space.ts']).toContain("query: '/data/stats.json'");
    expect(files['src/space.ts']).toContain("value: 'stats.data.value'");
  });

  it('can take a screenshot of any page from the command line', () => {
    const files = scaffold(answers({ mode: 'client' }));
    const { scripts } = JSON.parse(files['package.json']) as { scripts: Record<string, string> };

    expect(scripts.shot).toBe('node scripts/shot.ts');
    expect(files['scripts/shot.ts']).toContain('fullPage: true');
    expect(files['scripts/shot.ts']).toContain('const PORT = 5173;');
  });

  /**
   * `compile` is what makes a server-mode plugin part of the HTML rather than something hydration adds later.
   * The browser build has no server to compile anything, so it registers the component it already bundles.
   */
  it('registers the plugin the way each mode can actually render it', () => {
    const server = scaffold(answers())['src/main.ts'];
    const client = scaffold(answers({ mode: 'client' }))['src/main.ts'];

    expect(server).toContain("action: 'compile' as const");
    expect(server).toContain('plugins/StatCard/index.ts');
    expect(client).toContain('const plugins = { statCard: { component: StatCard } };');
    expect(client).toContain("import StatCard from './plugins/StatCard';");
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

  /** A deploy or a restart closes the server rather than dropping it, so what it is running finishes first. */
  it('closes its server when the process is told to stop, local or cloud', () => {
    for (const source of ['local', 'cloud'] as const) {
      const main = scaffold(answers({ source }))['src/main.ts'];

      expect(main).toMatch(/import \{[^}]*\bcloseOnSignals\b[^}]*\} from '@plitzi\/sdk-server';/);
      expect(main).toContain('closeOnSignals(server);');
    }

    // A browser project has no server to close.
    expect(scaffold(answers({ mode: 'client' }))['src/main.ts']).not.toContain('closeOnSignals');
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

  /**
   * `@eslint/js` declares the `eslint` it was written for as a peer, and npm refuses a tree that disagrees — so a
   * major apart is not a lint problem but a project whose very first `npm install` fails.
   */
  it('installs the eslint its own lint config is written for', () => {
    const { devDependencies } = JSON.parse(scaffold(answers())['package.json']) as {
      devDependencies: Record<string, string>;
    };
    const major = (range = ''): string => range.replace(/^\D*/, '').split('.')[0] ?? '';

    expect(major(devDependencies.eslint)).toBe(major(devDependencies['@eslint/js']));
  });

  /** A space grows pages, and a test pinned to the home page stops covering it the moment it does. */
  it('checks every page the space has, not only the home page', () => {
    const spec = scaffold(answers())['visual/home.spec.ts'];

    expect(spec).toContain('Object.values(handles.pages)');
    expect(spec).toContain('page.goto(pageHandle.path');
    // What a bare visit cannot show is not held against the page: a session, a route param, a condition.
    expect(spec).toContain("pageHandle.accessLevel !== 'authenticated' && pageHandle.params.length === 0");
    // The condition, the list row and the boxless provider are set aside by `inspectPage`, from what authoring knows.
    expect(spec).toContain('inspectPage(page, handles, { page: pageHandle.id })');
  });

  /**
   * Node runs the project's TypeScript itself: no transpiler loads beside the server, whose loader thread cost more
   * memory than the server. What that needs is checked by `tsc` rather than discovered at `npm start`.
   */
  it('runs its TypeScript on Node alone, in either mode', () => {
    for (const mode of ['client', 'server'] as const) {
      const files = scaffold(answers({ mode }));
      const { scripts, devDependencies, engines } = JSON.parse(files['package.json']) as {
        scripts: Record<string, string>;
        devDependencies: Record<string, string>;
        engines: Record<string, string>;
      };
      const { compilerOptions } = JSON.parse(files['tsconfig.json']) as { compilerOptions: Record<string, unknown> };

      expect(scripts.author).toBe('node src/author.ts');
      expect(devDependencies.tsx).toBeUndefined();
      expect(engines.node).toBe('>=22.18');
      expect(compilerOptions).toMatchObject({
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        erasableSyntaxOnly: true
      });
      expect(files['src/author.ts']).toContain("from './space.ts'");
    }

    const server = JSON.parse(scaffold(answers({ mode: 'server' }))['package.json']) as {
      scripts: Record<string, string>;
    };
    expect(server.scripts.start).toBe('node src/main.ts');
  });

  /**
   * Production runs JavaScript: stripping types loads a TypeScript transformer into the server for its whole life
   * (~10 MB), so a deployment runs what `build` emitted. The plugins stay source — the page server builds them.
   */
  it('builds the server to JavaScript for production, leaving the plugins to the page server', () => {
    const files = scaffold(answers({ mode: 'server' }));
    const { scripts } = JSON.parse(files['package.json']) as { scripts: Record<string, string> };
    const build = JSON.parse(files['tsconfig.build.json']) as {
      compilerOptions: Record<string, unknown>;
      exclude: string[];
    };

    expect(scripts.build).toBe('tsc -p tsconfig.build.json');
    expect(scripts['start:prod']).toBe('node dist/main.js');
    expect(build.compilerOptions).toMatchObject({
      noEmit: false,
      outDir: 'dist',
      rewriteRelativeImportExtensions: true
    });
    expect(build.exclude).toEqual(['src/plugins']);
    // The same path from `src/main.ts` and from `dist/main.js`.
    expect(files['src/main.ts']).toContain("path.resolve(PROJECT_ROOT, 'src/plugins/StatCard/index.ts')");
    expect(scaffold(answers({ mode: 'client' }))['tsconfig.build.json']).toBeUndefined();
  });

  it('listens where the deployment says, loopback when it says nothing', () => {
    const main = scaffold(answers({ mode: 'server' }))['src/main.ts'];

    expect(main).toContain("const HOST = process.env.HOST ?? '127.0.0.1';");
    expect(main).toContain('server.listen(PORT, HOST);');
  });

  // Claude Code finds the skill on its own; any other agent looks for AGENTS.md, and CLAUDE.md imports it.
  it('tells any agent where to start, with the commands this project really has', () => {
    const local = scaffold(answers());
    const cloud = scaffold(answers({ source: 'cloud' }));

    expect(local['AGENTS.md']).toContain('.claude/skills/plitzi-authoring/SKILL.md');
    expect(local['AGENTS.md']).toMatch(/`npm run author` \| author the space/);
    expect(local['CLAUDE.md']).toBe('@AGENTS.md\n');
    // A space that lives in Plitzi has no `author` script to run.
    expect(cloud['AGENTS.md']).not.toContain('run author');
  });

  it('carries the authoring skill for whatever agent opens the project', () => {
    const files = scaffold(answers());

    expect(files['.claude/skills/plitzi-authoring/SKILL.md']).toContain('---');
    // The references the skill links to travel with it, or every link in it points at nothing.
    expect(files['.claude/skills/plitzi-authoring/reference/layouts.md']).toContain('activeOn');
    expect(files['.claude/skills/plitzi-authoring/reference/review-checklist.md']).toBeDefined();
  });

  /** Vite binds `localhost`, which is IPv6 here, while everything waiting for a dev server asks 127.0.0.1. */
  it('pins the dev server to the address its own tests wait on', () => {
    const files = scaffold(answers({ mode: 'client' }));

    expect(files['vite.config.ts']).toContain("host: '127.0.0.1'");
    expect(files['playwright.config.ts']).toContain('127.0.0.1');
  });
});

describe('plitzi create', () => {
  it('writes a project that can be installed and started', async () => {
    await inTemp(async dir => {
      const target = path.join(dir, 'my-site');
      await create(target, { install: false, packageManager: 'npm', mode: 'server', source: 'local' });

      const written = await fs.readdir(target);
      expect(written.sort()).toEqual([
        '.claude',
        '.gitignore',
        '.prettierignore',
        '.prettierrc',
        'AGENTS.md',
        'CLAUDE.md',
        'README.md',
        'eslint.config.mjs',
        'package.json',
        'playwright.config.ts',
        'scripts',
        'src',
        'tsconfig.build.json',
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
      await create(dir, {
        packageManager: 'npm',
        mode: 'server',
        source: 'cloud',
        key: 'host_key_123',
        install: false,
        force: true
      });

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

  /**
   * An agent runs this with nobody at its terminal, and used to get a project built around choices nobody made — the
   * package manager of whatever invoked it, a Node tier, the space in the repo. The choices are the person's, so with
   * nobody to ask it stops, writes nothing, and says exactly what to ask them.
   */
  it('refuses to choose for the person when nobody is at the terminal, and says what to ask them', async () => {
    await inTemp(async dir => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await create(dir, { install: false, mode: 'client' });

      const said = error.mock.calls.flat().join('\n');
      expect(said).toContain('If you are an AI agent: ask the user');
      expect(said).toContain('--package-manager npm | yarn | pnpm');
      expect(said).toContain('--source local | cloud');
      expect(said).not.toContain('--mode server | client');
      // It used to end with "or with --yes to take the defaults", and an agent took that exit instead of asking.
      expect(said).not.toContain('--yes');
      expect(process.exitCode).toBe(1);
      expect(await fs.readdir(dir)).toEqual([]);

      error.mockRestore();
      process.exitCode = 0;
    });
  });

  it('does not let --yes answer for a person who is not there', async () => {
    await inTemp(async dir => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await create(dir, { install: false, yes: true });

      expect(error.mock.calls.flat().join('\n')).toContain('--mode server | client');
      expect(process.exitCode).toBe(1);
      expect(await fs.readdir(dir)).toEqual([]);

      error.mockRestore();
      process.exitCode = 0;
    });
  });

  it('asks for the cloud key instead of failing over an empty one when nobody is at the terminal', async () => {
    await inTemp(async dir => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await create(dir, { install: false, packageManager: 'npm', mode: 'client', source: 'cloud' });

      const said = error.mock.calls.flat().join('\n');
      expect(said).toContain('--key <key>');
      expect(said).toContain('public render key');
      expect(await fs.readdir(dir)).toEqual([]);

      error.mockRestore();
      process.exitCode = 0;
    });
  });

  it('takes the defaults for what was not passed when a person at the terminal says --yes', async () => {
    await inTemp(async dir => {
      await atTerminal(() => create(dir, { install: false, yes: true, packageManager: 'pnpm' }));

      const manifest = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8')) as {
        dependencies: Record<string, string>;
      };
      // server + local: the Node tier's server package, and the space in the project.
      expect(manifest.dependencies).toHaveProperty('@plitzi/sdk-server');
      expect(await fs.readFile(path.join(dir, 'src', 'space.ts'), 'utf-8')).toContain('SpaceSpec');
      expect(await fs.readFile(path.join(dir, 'README.md'), 'utf-8')).toContain('pnpm');
    });
  });
});
