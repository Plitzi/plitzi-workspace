/* eslint-disable quotes -- the generated code quotes its own strings, and reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { scaffold } from '.';
import { MACHINERY } from './machinery';
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
      "await serveProject({\n  entry: import.meta.url,\n  // The space, authored at boot and checked against what the project's files say — its plugins, its data.\n  space: authorSpace(space, await projectAuthoring(new URL('..', import.meta.url))),\n  actions,\n  connectors,\n  serverOptions\n});"
    );
    expect(main.split('\n').filter(line => line.startsWith('import ')).length).toBe(7);
    expect(gitignore(answers())).toContain('tmp\n');
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
   * An import is evaluated before the body of the module importing it: `.env` read in `main.ts`'s body came after
   * `serverOptions.ts` and the actions had read `process.env` at their top level — and found nothing.
   */
  it('reads .env before anything it imports does, from a module imported first', () => {
    for (const source of ['local', 'cloud'] as const) {
      const files = serverFiles(answers({ source }));
      const imports = files['src/main.ts'].split('\n').filter(line => line.startsWith('import '));

      expect(imports[0]).toBe("import './env.ts';");
      expect(files['src/main.ts']).not.toContain('loadEnvFile');
      expect(files['src/env.ts']).toContain("process.loadEnvFile(new URL('../.env', import.meta.url));");
      expect(MACHINERY.has('src/env.ts')).toBe(true);
    }
  });

  it('names a cloud project’s server for /health by the project, a local one’s space naming it', () => {
    expect(serverFiles(answers({ source: 'cloud' }))['src/main.ts']).toContain("  cloud: { name: 'catalog' },");
    expect(serverFiles(answers({ source: 'cloud', name: "o'brien" }))['src/main.ts']).toContain(
      "  cloud: { name: 'o\\'brien' },"
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
