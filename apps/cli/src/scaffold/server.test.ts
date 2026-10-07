/* eslint-disable quotes -- the generated code quotes its own strings, and reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { scaffold } from '.';
import { MACHINERY, RETIRED_MACHINERY } from './machinery';
import { gitignore } from './project';
import { serverFiles } from './server';
import { visualFiles } from './visual';

import type { CreateAnswers } from './types';

const answers = (over: Partial<CreateAnswers> = {}): CreateAnswers => ({
  name: 'catalog',
  mode: 'server',
  source: 'local',
  key: '',
  environment: 'main',
  packageManager: 'npm',
  ...over
});

describe('the server a project starts', () => {
  it('serves public/ to anyone, and reads its own data from src/data/, which it never serves', () => {
    const files = serverFiles(answers());

    expect(files['src/data/.gitkeep']).toBe('');
    expect(files['public/.gitkeep']).toBe('');
    expect(files['public/data/.gitkeep']).toBeUndefined();
  });

  /**
   * What the project's server does is `serveProject`'s, in `@plitzi/sdk-server/project`: a fix to it arrives with the
   * package. The entry point hands it what is the project's — its space, actions and options — and nothing else.
   */
  it('hands the server the project’s own parts and nothing else', () => {
    const main = serverFiles(answers())['src/main.ts'];

    expect(main).toContain("import { serveProject } from '@plitzi/sdk-server/project';");
    expect(main).toContain(
      "\nawait serveProject({\n  space: async () => authorSpace((await import('./space/index.ts')).space, await projectAuthoring()),\n  actions,\n  connectors,\n  serverOptions\n});\n"
    );
    expect(main.split('\n').filter(line => line.startsWith('import ')).length).toBe(5);
    expect(gitignore(answers())).toContain('tmp\n');
  });

  /**
   * The project is the folder its scripts run in: nothing of it is worked out from where a file is, which is what lets
   * the same entry point run from `src/` and, built, from `dist/`.
   */
  it('names no folder: the project is where its scripts start it', () => {
    for (const source of ['local', 'cloud'] as const) {
      const files = scaffold(answers({ source }));

      expect(files['src/main.ts']).not.toContain('import.meta.url');
      expect(files['src/main.ts']).not.toContain('entry');
    }

    expect(scaffold(answers())['plitzi/author.ts']).toContain('  options = await projectAuthoring();');
    expect(scaffold(answers())['visual/home.spec.ts']).toContain(
      'const { handles } = authorSpace(space, await projectAuthoring());'
    );
  });

  it('re-authors a saved space over IPC, writing nothing beside the source or in tmp/', () => {
    const files = scaffold(answers());

    expect(files['plitzi/author.ts']).toContain("const ipc = process.argv.includes('--ipc');");
    expect(files['plitzi/author.ts']).toContain('process.send?.({ schema, style }, () => process.disconnect?.());');
    expect(files['plitzi/author.ts']).not.toContain('--out');
    expect(Object.values(files).filter(text => text.includes('tmp/space.json'))).toEqual([]);
  });

  it('types the project’s options as what the server leaves to it', () => {
    const options = serverFiles(answers())['src/config/serverOptions.ts'];

    expect(options).toContain("import type { ProjectServerOptions } from '@plitzi/sdk-server/project';");
    expect(options).toContain('export const serverOptions: ProjectServerOptions = {};');
    expect(options).not.toContain('SetByMain');
  });

  /**
   * An import is evaluated before the body of the module importing it, so `.env` is read before any of the project's
   * modules is: `serverOptions.ts` and the actions find their settings in `process.env` at their top level.
   */
  it('reads .env before any module of the project is evaluated, with no file of the project to do it', () => {
    for (const source of ['local', 'cloud'] as const) {
      const files = scaffold(answers({ source }));
      const { scripts } = JSON.parse(files['package.json']) as { scripts: Record<string, string> };

      expect(files['src/env.ts']).toBeUndefined();
      expect(files['src/main.ts']).not.toContain('env.ts');
      expect(files['src/main.ts']).not.toContain('loadEnvFile');
      for (const name of ['start', 'start:prod', ...(source === 'local' ? ['author'] : [])]) {
        expect(scripts[name]).toMatch(/^node --env-file-if-exists=\.env /);
      }

      // Node's flag under `--watch-path` has the watcher restart on any write in the project's root — the server's
      // own `tmp/` among them — so the watched process preloads it instead.
      expect(scripts['start:dev']).toMatch(/^node --import @plitzi\/sdk-server\/env --watch-path=/);
      expect(scripts['start:dev']).not.toContain('--env-file');
    }

    expect(MACHINERY.has('src/env.ts')).toBe(false);
    expect(RETIRED_MACHINERY).toEqual({ 'src/env.ts': 'src/main.ts' });
  });

  it('names a cloud project’s server for /health by the project, a local one’s space naming it', () => {
    expect(serverFiles(answers({ source: 'cloud' }))['src/main.ts']).toContain(
      "await serveProject({ cloud: { name: 'catalog' }, serverOptions });"
    );
    expect(serverFiles(answers({ source: 'cloud', name: "o'brien" }))['src/main.ts']).toContain(
      "cloud: { name: 'o\\'brien' }"
    );
    // A property a line once the call is longer than the project's 120 columns, as its Prettier writes it.
    const long = 'a'.repeat(80);
    expect(serverFiles(answers({ source: 'cloud', name: long, fromSpace: true }))['src/main.ts']).toContain(
      `await serveProject({\n  cloud: { name: '${long}' },\n  actions,\n  connectors,\n  serverOptions\n});`
    );
    expect(serverFiles(answers({ source: 'cloud' }))['src/main.ts']).not.toContain('@plitzi/sdk-authoring');
  });
});

describe('the scripts that look at it', () => {
  it('find the port the server took', () => {
    expect(visualFiles(answers())['playwright.config.ts']).toContain('process.env.PORT ?? recorded().port ?? 8080');
  });

  it('find it by the name and port it wrote down', () => {
    expect(visualFiles(answers())['playwright.config.ts']).toContain("'tmp/dev-server.json'");
  });
});
