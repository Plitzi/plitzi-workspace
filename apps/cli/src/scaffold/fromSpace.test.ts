/* eslint-disable quotes */
import { describe, expect, it } from 'vitest';

import { defineAction } from '@plitzi/sdk-authoring';

import { envFromSpace, projectFromSpace } from './fromSpace';
import { machineryFiles, scaffold } from './index';
import { SDK_VERSION } from './project';

import type { CreateAnswers } from './types';
import type { SpaceExport } from '@plitzi/sdk-shared/source';

const encode = (text: string): string => Buffer.from(text).toString('base64');

const WORLD = 'https://cdn.example.com/pizarra/assets/a_world.json';
const CHART = 'https://cdn.example.com/pizarra/plugins/oldChart/1.0.0';

const boardCreate = defineAction({
  id: 'board-create',
  name: 'Create a board',
  trigger: { type: 'call', access: 'public', input: { title: { type: 'text' } } },
  steps: [{ id: 'board', task: 'board.create', params: { title: '{{ input.title }}', map: WORLD } }]
});
const handWritten = defineAction({
  id: 'board-clear',
  name: 'Clear a board',
  trigger: { type: 'call', access: 'session' },
  steps: [{ id: 'cleared', task: 'board.clear' }]
});
handWritten.document.nodes.cleared.title = 'Wipe everything';

const exported = (overrides: Partial<SpaceExport> = {}): SpaceExport => ({
  format: 1,
  space: { id: 42, name: 'Pizarra', permanentUrl: 'pizarra' },
  version: { environment: 'main', revision: 0, snapshot: null },
  draft: 'draft-1',
  authoring: {
    exportName: 'pizarra',
    files: {
      'index.ts': "import { homePage } from './pages/home.ts';\n",
      'pages/home.ts': `export const homePage = { src: '${WORLD}' };\n`
    }
  },
  actions: [
    { identifier: 'board-create', name: 'Create a board', document: boardCreate.document },
    { identifier: 'board-clear', name: 'Clear a board', document: handWritten.document }
  ],
  connectors: [],
  functions: { version: 'v1', files: { 'index.ts': 'export default {};\n' } },
  data: { version: 'd1', files: { 'stock.json': `{ "map": "${WORLD}" }` } },
  source: {
    files: {
      'runtime.ts': encode("import { model } from './board/model.ts';\nexport default model;\n"),
      'board/model.ts': encode('export const model = 1;\n'),
      'plugins/Board/index.ts': encode('export {};\n'),
      'plugins/Board/declaration.ts': encode('export default {};\n'),
      'plugins/Board/hand.woff2': Buffer.from([0, 1, 2]).toString('base64')
    },
    dependencies: { zod: '^4.0.0', '@plitzi/sdk-shared': '^0.30.0', react: '19.0.0' },
    runtime: { entries: ['runtime.ts'] },
    plugins: [{ type: 'board', entries: ['plugins/Board/index.ts'] }]
  },
  builtOnly: {
    plugins: [
      {
        type: 'oldChart',
        files: [{ url: `${CHART}/plugin-manifest.json`, path: 'plugin-manifest.json' }],
        functions: { 'index.ts': 'export default {};\n' }
      }
    ],
    runtime: null
  },
  assets: [{ url: WORLD, path: 'assets/a_world.json' }],
  variables: ['REDIS_URL'],
  credentials: [{ identifier: 'smtp-main', name: 'Mail', provider: 'smtp' }],
  visitorRoles: ['editor'],
  report: {
    conflicts: [{ path: 'board/model.ts', kept: 'the plugin board', others: ['the runtime'] }],
    rangeConflicts: [],
    corrections: []
  },
  ...overrides
});

const answers = (source: CreateAnswers['source'] = 'local'): CreateAnswers => ({
  name: 'my-board',
  mode: 'server',
  source,
  key: source === 'cloud' ? 'host-key' : '',
  environment: 'main',
  packageManager: 'npm'
});

const SECRET = 's'.repeat(64);

/** The server every server project runs, a project made from a space included. */
const serverMain = scaffold({ ...answers(), fromSpace: true })['src/main.ts'];

describe('a project made from a space', () => {
  const project = projectFromSpace(exported(), 'local');

  it('holds the source its plugins and runtime were built from, under src/, bytes and all', () => {
    expect(project.files['src/runtime.ts']).toContain("from './board/model.ts'");
    expect(project.files['src/board/model.ts']).toBe('export const model = 1;\n');
    expect(project.binaries['src/plugins/Board/hand.woff2']).toBe(Buffer.from([0, 1, 2]).toString('base64'));
    // Declared by being there: the server and the author script find each folder's `declaration.ts`.
    expect(project.files['src/plugins/declarations.ts']).toBeUndefined();
    expect(project.omit).toContain('src/plugins/StatCard/index.ts');
  });

  it('holds the space as code, serving its files from the project instead of Plitzi’s CDN', () => {
    // Exported as `space` too: the name the server, the author script and the checks import it by.
    expect(project.files['src/space/index.ts']).toContain('export { pizarra as space };');
    expect(project.files['src/space/pages/home.ts']).toContain("src: '/assets/a_world.json'");
    expect(project.downloads).toEqual([
      { url: WORLD, to: 'public/assets/a_world.json' },
      { url: `${CHART}/plugin-manifest.json`, to: 'vendor/plugins/oldChart/plugin-manifest.json' }
    ]);
  });

  /** Its server is every project's: what it brought besides is read from where it lands, so `upgrade` keeps it. */
  it('writes no server of its own — the one every project has runs what the space brought', () => {
    expect(project.files['src/main.ts']).toBeUndefined();
    expect(project.files['.prettierignore']).toBeUndefined();
  });

  /**
   * `vendor/plugins/` is where `serveProject` runs a plugin as it was built, and where `projectAuthoring` reads the
   * element types it provides: the server and `npm run author` hold the space to the same plugins.
   */
  it('runs a plugin it has no source of as it was built, on its server and authored as a plugin’s', () => {
    expect(project.downloads).toContainEqual({
      url: `${CHART}/plugin-manifest.json`,
      to: 'vendor/plugins/oldChart/plugin-manifest.json'
    });
    expect(serverMain).toContain('await projectAuthoring()');
    expect(scaffold({ ...answers(), fromSpace: true })['plitzi/author.ts']).toContain('await projectAuthoring()');
  });

  it('keeps a built plugin’s server half beside it, where its manifest names it', () => {
    expect(JSON.parse(project.files['vendor/plugins/oldChart/functions.source.json'])).toEqual({
      'index.ts': 'export default {};\n'
    });
  });

  it('says what its visitors need of a server of its own, where its auth would go', () => {
    expect(project.report).toEqual(
      expect.arrayContaining([expect.stringContaining('`createAuth` from @plitzi/sdk-server/auth as `auth`')])
    );
  });

  it('runs its actions, functions and runtime on its own server, signing with a key of its own', () => {
    expect(project.files['src/actions/board-create.ts']).toContain(
      "import { defineAction } from '@plitzi/sdk-authoring';\n\nexport const boardCreateAction = defineAction({ id: 'board-create'"
    );
    expect(project.files['src/actions/board-create.ts']).toContain("map: '/assets/a_world.json'");
    expect(project.files['src/actions/board-clear.json']).toContain('"id": "board-clear"');
    expect(project.files['src/actions/index.ts']).toContain("import { boardCreateAction } from './board-create.ts';");
    expect(project.files['src/actions/index.ts']).toContain(
      'export const actions: ActionEntry[] = [\n  boardCreateAction,'
    );
    expect(project.files['src/actions/index.ts']).toContain('export const connectors = new Map(');
    expect(project.files['src/functions/index.ts']).toBe('export default {};\n');

    // Its runtime where every project keeps one, handing over the module its source starts at.
    expect(project.files['src/runtime/index.ts']).toContain("export { default } from '../runtime.ts';");
    // The server runs them all from where they are — `src/runtime/`, `src/functions/`, the actions it is handed.
    expect(serverMain).toContain(', actions, connectors, serverOptions });');
    expect(scaffold({ ...answers(), fromSpace: true })['src/env.ts']).toBeUndefined();

    const env = envFromSpace(exported(), answers(), SECRET);
    expect(env).toContain(`PLITZI_SIGNING_SECRET=${SECRET}`);
    expect(env).toContain('REDIS_URL=');
    expect(project.files['.env']).toBeUndefined();
    expect(project.files['.env.example']).toContain('PLITZI_SIGNING_SECRET=\n');
    expect(project.files['.env.example']).toMatch(/^# The settings \.env holds, with no secret in them/);
    expect(project.files['.env.example']).toContain('REDIS_URL=\n');
    expect(project.functions).toEqual({ version: 'v1', files: { 'index.ts': 'export default {};\n' } });
  });

  it('installs what the source imports, on this CLI’s SDK and React', () => {
    const { dependencies } = project;

    expect(dependencies).toMatchObject({ zod: '^4.0.0', '@plitzi/sdk-shared': SDK_VERSION });
    expect(dependencies.react).not.toBe('19.0.0');
  });

  it('says what came across differently, or not at all', () => {
    expect(project.report).toEqual(
      expect.arrayContaining([
        expect.stringContaining('src/board/model.ts: the plugin board and the runtime held different copies'),
        expect.stringContaining(
          `@plitzi/sdk-shared: the source was written against ^0.30.0, and the project runs ${SDK_VERSION}`
        ),
        expect.stringContaining('oldChart: no source of this plugin was kept, so it runs as it was built'),
        'src/actions/board-clear.json stays JSON: the step "cleared" is titled "Wipe everything", and code titles a step by its task',
        expect.stringContaining('REDIS_URL, smtp-main'),
        expect.stringContaining('Its visitors (editor) signed in with Plitzi')
      ])
    );
  });
});

describe('a project made from a space it reads from Plitzi', () => {
  const project = projectFromSpace(exported({ authoring: null }), 'cloud');

  it('writes no pages, reads them with its key, and watches the space by the name its adapters give it', () => {
    expect(project.files['src/space/index.ts']).toBeUndefined();
    expect(scaffold({ ...answers('cloud'), fromSpace: true })['src/main.ts']).toContain("cloud: { name: 'my-board' }");
    const env = envFromSpace(exported({ authoring: null }), answers('cloud'), SECRET);
    expect(env).toContain('PLITZI_HOST_KEY=host-key');
    expect(env).toContain(`PLITZI_SIGNING_SECRET=${SECRET}`);
    // Its actions came across with it, so they run here as a local space's do — a cloud one of its own has none.
    expect(scaffold({ ...answers('cloud'), fromSpace: true })['src/main.ts']).toContain(
      "await serveProject({ cloud: { name: 'my-board' }, actions, connectors, serverOptions });"
    );
    expect(scaffold({ ...answers('cloud') })['src/main.ts']).not.toContain('actions');
  });
});

describe('the server a project made from a space runs', () => {
  const create = scaffold({ ...answers(), fromSpace: false });

  it('is the one `create` writes — its port, health, reloads and settings — with what the space brought besides', () => {
    const main = scaffold({ ...answers(), fromSpace: true, runtime: true })['src/main.ts'];

    expect(main).toBe(create['src/main.ts']);
    expect(main).toContain('await serveProject({ ');
  });

  it('keeps its actions and connectors in folders there from the start, which `start:dev` restarts on', () => {
    const written = scaffold({ ...answers(), fromSpace: true });
    expect(written['src/connectors/.gitkeep']).toBe('');
    expect(written['plitzi/README.md']).toContain('## `src/actions/` and `src/connectors/`');
    // The CLI's, so `upgrade` writes them into a project made before them, with the script that watches them.
    expect(machineryFiles({ ...answers(), fromSpace: true })).toHaveProperty(['src/connectors/.gitkeep']);
    const manifest: unknown = JSON.parse(scaffold({ ...answers(), fromSpace: true })['package.json']);
    expect(manifest).toHaveProperty(
      ['scripts', 'start:dev'],
      'node --import @plitzi/sdk-server/env --watch-path=./src/main.ts --watch-path=./src/config --watch-path=./src/actions --watch-path=./src/connectors --watch-path=./src/functions src/main.ts'
    );
  });
});

describe('the source of a project that already had a src/', () => {
  it('keeps its paths as they were', () => {
    const project = projectFromSpace(
      exported({
        source: {
          files: { 'src/plugins/Card/index.ts': encode('export {};\n') },
          dependencies: {},
          runtime: null,
          plugins: [{ type: 'card', entries: ['src/plugins/Card/index.ts'] }]
        }
      }),
      'local'
    );

    expect(project.files['src/plugins/Card/index.ts']).toBe('export {};\n');
    expect(project.files['src/src/plugins/Card/index.ts']).toBeUndefined();
    // No runtime came across: nothing to hand over.
    expect(project.files['src/runtime/index.ts']).toBeUndefined();
  });
});
