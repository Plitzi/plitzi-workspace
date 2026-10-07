// @vitest-environment node
/* eslint-disable quotes -- the messages quote code and say what is the project's, and read best in the other quotes */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  assertProjectLayout,
  checkPluginFolder,
  checkProjectLayout,
  pluginEntry,
  PROJECT_LAYOUT_CODES,
  ProjectLayoutError,
  readVendorPlugin
} from './layout';

import type { LayoutFinding } from './layout';

let root: string;

const write = (file: string, text = ''): void => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

const folder = (dir: string): void => {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
};

/** A plugin folder as `plitzi plugin add` writes it. */
const plugin = (name: string): void => {
  write(`src/plugins/${name}/${name}.tsx`, 'export default () => null;\n');
  write(`src/plugins/${name}/index.ts`, `export { default } from './${name}.tsx';\n`);
  write(`src/plugins/${name}/declaration.ts`, `export default { type: '${name}' };\n`);
};

/** A server project with its space in it, whole: what `plitzi create --mode server` writes, as far as its layout goes. */
const project = (): void => {
  write('package.json', JSON.stringify({ dependencies: { '@plitzi/sdk-server': '0.38.6' } }));
  write('.env', '# what the actions sign with\nPLITZI_SIGNING_SECRET=abc123\n');
  write('.env.example', '# what the actions sign with\nPLITZI_SIGNING_SECRET=\n');
  write('src/space/index.ts', 'export const space = { name: "Shop", permanentUrl: "shop", pages: [] };\n');
  write('plitzi/author.ts', '');
  write('src/plugins/.gitkeep');
  write('src/functions/.gitkeep');
  write('src/data/products.json', '{}');
  write('public/logo.svg', '<svg/>');
};

const codes = (findings: readonly LayoutFinding[]): string[] => findings.map(each => each.code);

const only = (code: string): LayoutFinding => {
  const found = checkProjectLayout(root).filter(each => each.code === code);
  expect(found).toHaveLength(1);

  return found[0];
};

/** Whether this disk tells `a` from `A` — Linux's does; macOS's and Windows' do not, by default. */
const caseSensitive = (): boolean => {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-case-'));
  fs.writeFileSync(path.join(probe, 'a'), '');
  const sensitive = !fs.existsSync(path.join(probe, 'A'));
  fs.rmSync(probe, { recursive: true, force: true });

  return sensitive;
};

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-layout-')));
  project();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('a project laid out as the CLI lays it out', () => {
  it('has nothing to say', () => {
    plugin('Card');
    write('src/plugins/Card/functions/index.ts', 'export default {};\n');
    write('src/functions/index.ts', 'export default {};\n');
    write('src/runtime/index.ts', 'export default {};\n');
    write('src/functions/README.md', '# functions\n');

    expect(checkProjectLayout(root)).toEqual([]);
    expect(assertProjectLayout(root)).toEqual([]);
  });

  it('says every code it finds in its catalogue, at the level the catalogue gives it', () => {
    write('src/plugins/story-editor/index.ts');
    write('src/.env', 'A=1\n');
    write('src/Data/x.json', '{}');

    for (const each of checkProjectLayout(root)) {
      expect(PROJECT_LAYOUT_CODES[each.code].level).toBe(each.level);
      expect(each.message).toContain(each.file.replace(/\/$/, ''));
      expect(each.fix.length).toBeGreaterThan(0);
    }
  });
});

describe('the plugins', () => {
  it('refuses a folder with no entry, saying what to write — the component it has, named', () => {
    write('src/plugins/Card/Card.tsx', 'export default () => null;\n');
    write('src/plugins/Card/declaration.ts', "export default { type: 'card' };\n");

    expect(only('plugin-entry-missing')).toEqual({
      level: 'error',
      code: 'plugin-entry-missing',
      file: 'src/plugins/Card/',
      message: 'src/plugins/Card/ has no index.ts (or index.tsx), so the server cannot build the plugin card.',
      fix: "Write src/plugins/Card/index.ts exporting the component by default — export { default } from './Card.tsx'; — as npx plitzi plugin add writes it. Every folder of src/plugins/ is a plugin: code several plugins share goes outside it (src/shared/)."
    });
    expect(pluginEntry(root, 'Card')).toBeUndefined();
  });

  it('builds a plugin from index.tsx as from index.ts — and refuses a folder with both', () => {
    write('src/plugins/Card/index.tsx', 'export default () => <div />;\n');
    write('src/plugins/Card/declaration.ts', "export default { type: 'card' };\n");

    expect(checkProjectLayout(root)).toEqual([]);
    expect(pluginEntry(root, 'Card')).toBe(path.join(root, 'src/plugins/Card/index.tsx'));

    write('src/plugins/Card/index.ts', '');
    expect(only('plugin-entry-ambiguous')).toMatchObject({ level: 'error', file: 'src/plugins/Card/' });
    expect(pluginEntry(root, 'Card')).toBeUndefined();
  });

  it('refuses a JavaScript entry, renamed by the fix: .jsx to index.tsx, the rest to index.ts', () => {
    write('src/plugins/Card/index.jsx');
    write('src/plugins/Card/declaration.ts');
    write('src/plugins/Chart/index.mjs');
    write('src/plugins/Chart/declaration.ts');

    const found = checkProjectLayout(root).filter(each => each.code === 'entry-not-typescript');

    expect(found.map(each => each.autofix)).toEqual([
      { action: 'move', from: 'src/plugins/Card/index.jsx', to: 'src/plugins/Card/index.tsx' },
      { action: 'move', from: 'src/plugins/Chart/index.mjs', to: 'src/plugins/Chart/index.ts' }
    ]);
    expect(found[0].message).toContain(
      "src/plugins/Card/index.jsx is JavaScript, and src/plugins/Card/ is built from index.ts (or index.tsx): the project's code is TypeScript"
    );
    expect(found[0].fix).toContain('git mv src/plugins/Card/index.jsx src/plugins/Card/index.tsx');
  });

  it('asks whether a near name was meant — a typo, a capital — and renames it', () => {
    write('src/plugins/Card/indx.ts');
    write('src/plugins/Card/declaration.ts');

    expect(only('plugin-entry-missing')).toMatchObject({
      file: 'src/plugins/Card/indx.ts',
      message: expect.stringContaining('did you mean indx.ts?') as unknown,
      autofix: { action: 'move', from: 'src/plugins/Card/indx.ts', to: 'src/plugins/Card/index.ts' }
    });
  });

  it.skipIf(caseSensitive())('says a capital differs on Linux, though this disk finds it', () => {
    write('src/plugins/Card/Index.ts');
    write('src/plugins/Card/declaration.ts');

    const said = only('plugin-entry-missing');

    expect(said.message).toContain('not on Linux, where the project is deployed');
    expect(said.fix).toBe(
      'Rename it index.ts: git mv src/plugins/Card/Index.ts src/plugins/Card/Index.ts-tmp && git mv src/plugins/Card/Index.ts-tmp src/plugins/Card/index.ts'
    );
  });

  it('finds an entry one folder too deep, and moves it up', () => {
    write('src/plugins/Card/Card/index.ts');
    write('src/plugins/Card/declaration.ts');

    expect(only('plugin-entry-missing')).toMatchObject({
      file: 'src/plugins/Card/Card/',
      autofix: { action: 'move', from: 'src/plugins/Card/Card/', to: 'src/plugins/Card/' }
    });
  });

  it('refuses a name that cannot be a type, offering the one it can be', () => {
    for (const [name, named] of [
      ['story-editor', 'StoryEditor'],
      ['2col', 'Col2'],
      ['My Plugin', 'MyPlugin']
    ]) {
      write(`src/plugins/${name}/index.ts`);

      const [said] = checkPluginFolder(root, name);

      expect(said).toMatchObject({ code: 'plugin-name-invalid', level: 'error', file: `src/plugins/${name}/` });
      expect(said.message).toContain(`Did you mean ${named}?`);
      expect(said.fix).toContain(`type: '${named.charAt(0).toLowerCase()}${named.slice(1)}'`);
      expect(pluginEntry(root, name)).toBeUndefined();
    }
  });

  it.skipIf(!caseSensitive())('refuses two folders that are the same type', () => {
    plugin('StoryEditor');
    plugin('storyEditor');

    expect(only('plugin-type-taken').message).toBe(
      'src/plugins/StoryEditor/ and src/plugins/storyEditor/ are both the plugin storyEditor: the server registers a folder by its name with a small first letter, and keeps one.'
    );
  });

  it('refuses a plugin’s functions/ with code and no index.ts — and leaves one with a placeholder alone', () => {
    plugin('Board');
    write('src/plugins/Board/functions/.gitkeep');
    expect(checkProjectLayout(root)).toEqual([]);

    write('src/plugins/Board/functions/routes.ts');
    expect(only('plugin-functions-entry-missing')).toMatchObject({
      level: 'error',
      file: 'src/plugins/Board/functions/',
      message:
        "src/plugins/Board/functions/ has no index.ts, so none of the plugin's server half runs (its routes under /fn/plugins/board/)."
    });
  });

  it('warns of a folder with no declaration, and of a declaration misnamed', () => {
    write('src/plugins/Card/index.ts');

    expect(only('plugin-declaration-missing')).toMatchObject({ level: 'warning', file: 'src/plugins/Card/' });

    write('src/plugins/Card/declarations.ts');
    expect(only('plugin-declaration-missing').autofix).toEqual({
      action: 'move',
      from: 'src/plugins/Card/declarations.ts',
      to: 'src/plugins/Card/declaration.ts'
    });
  });

  it('warns of a file where a plugin folder belongs — and leaves an older CLI’s list to the doctor', () => {
    write('src/plugins/Card.tsx');
    write('src/plugins/declarations.ts');

    expect(only('plugin-file-loose')).toMatchObject({
      file: 'src/plugins/Card.tsx',
      fix: expect.stringContaining('src/plugins/Card/Card.tsx and src/plugins/Card/index.ts') as unknown
    });
  });
});

describe('the built plugins', () => {
  const manifest = (type: string, value: unknown): void => {
    write(`vendor/plugins/${type}/plugin-manifest.json`, JSON.stringify(value));
  };

  it('reads what a manifest names to run', () => {
    manifest('chart', {
      version: '2.0.0',
      functions: 'functions.source.json',
      assets: { js: { src: 'chart.mjs', type: 'script', isMain: true }, css: { src: 'chart.css', type: 'style' } }
    });
    write('vendor/plugins/chart/chart.mjs');

    expect(checkProjectLayout(root)).toEqual([]);
    expect(readVendorPlugin(root, 'chart')).toEqual({
      script: path.join(root, 'vendor/plugins/chart/chart.mjs'),
      style: path.join(root, 'vendor/plugins/chart/chart.css'),
      version: '2.0.0',
      functions: path.join(root, 'vendor/plugins/chart/functions.source.json')
    });
  });

  it('refuses one with no manifest, one not JSON, and one naming no script or one not there', () => {
    folder('vendor/plugins/a');
    write('vendor/plugins/b/plugin-manifest.json', '{ nope');
    manifest('c', { assets: {} });
    manifest('d', { assets: { js: { src: 'd.mjs', type: 'script' } } });

    expect(
      checkProjectLayout(root)
        .filter(each => each.file.startsWith('vendor/'))
        .map(each => [each.code, each.file])
    ).toEqual([
      ['vendor-manifest-missing', 'vendor/plugins/a/'],
      ['vendor-manifest-invalid', 'vendor/plugins/b/plugin-manifest.json'],
      ['vendor-script-missing', 'vendor/plugins/c/plugin-manifest.json'],
      ['vendor-script-missing', 'vendor/plugins/d/plugin-manifest.json']
    ]);
  });

  it('refuses a plugin both built and in src/plugins/', () => {
    plugin('Chart');
    manifest('chart', { assets: { js: { src: 'chart.mjs', type: 'script' } } });
    write('vendor/plugins/chart/chart.mjs');

    expect(only('plugin-shadowed').file).toBe('vendor/plugins/chart/');
  });
});

describe('the project’s code', () => {
  it('refuses src/functions/ with code and no index.ts, and leaves a README alone', () => {
    write('src/functions/README.md');
    expect(checkProjectLayout(root)).toEqual([]);

    write('src/functions/tasks.ts');
    expect(only('functions-entry-missing').message).toBe(
      'src/functions/ has no index.ts, so none of the project’s functions runs.'
    );
  });

  it('refuses src/runtime/ with no index.ts', () => {
    write('src/runtime/server.ts');

    expect(only('runtime-entry-missing').fix).toContain('npx plitzi runtime add');
  });

  it('refuses a space with no entry, and one exported by default', () => {
    fs.rmSync(path.join(root, 'src/space/index.ts'));
    write('src/space/pages.ts');
    expect(only('space-entry-missing').message).toContain('src/space/ has no index.ts');

    write('src/space/index.ts', 'const space = {};\nexport default space;\n');
    expect(only('space-default-export').fix).toBe(
      'Export it as `export const space = …` instead of `export default …`.'
    );

    write('src/space/index.ts', 'const space = {};\nexport { space };\nexport default space;\n');
    expect(codes(checkProjectLayout(root))).not.toContain('space-default-export');
  });

  it('asks nothing of a space a cloud project keeps on Plitzi', () => {
    fs.rmSync(path.join(root, 'src/space'), { recursive: true });
    fs.rmSync(path.join(root, 'plitzi'), { recursive: true });

    expect(checkProjectLayout(root)).toEqual([]);
    expect(codes(checkProjectLayout(root, { space: 'local' }))).toEqual(['space-entry-missing']);
  });
});

describe('a folder named like one the server reads', () => {
  it('refuses code in it, and asks whether the folder was meant: src/plugin/, plugins/ at the root', () => {
    write('src/plugin/Card/index.ts');
    write('plugins/Chart/declaration.ts');

    const found = checkProjectLayout(root).filter(each => each.code === 'folder-misplaced');

    expect(found).toEqual([
      expect.objectContaining({
        level: 'error',
        file: 'src/plugin/',
        message:
          'src/plugin/ holds src/plugin/Card/index.ts, and nothing reads it there — did you mean src/plugins/? The server builds plugins from src/plugins/ only.',
        fix: 'Move what it holds into src/plugins/, and delete it.',
        autofix: { action: 'move', from: 'src/plugin/', to: 'src/plugins/' }
      }),
      expect.objectContaining({ file: 'plugins/', autofix: { action: 'move', from: 'plugins/', to: 'src/plugins/' } })
    ]);
  });

  it('warns of one with nothing it would read: src/function/, data/ at the root, src/runtimes/, src/public/', () => {
    folder('src/function');
    write('data/x.json', '{}');
    folder('src/runtimes');
    folder('src/public');

    expect(
      checkProjectLayout(root)
        .filter(each => each.code === 'folder-near-miss')
        .map(each => [each.file, each.fix])
    ).toEqual([
      ['src/function/', 'Move what it holds into src/functions/, and delete it.'],
      ['src/runtimes/', 'Move it: git mv src/runtimes src/runtime'],
      ['data/', 'Move what it holds into src/data/, and delete it.'],
      ['src/public/', 'Move what it holds into public/, and delete it.']
    ]);
  });

  it('refuses a functions/ an older CLI kept at the root, with its index', () => {
    write('functions/index.ts');

    expect(only('folder-misplaced').autofix).toEqual({ action: 'move', from: 'functions/', to: 'src/functions/' });
  });

  it.skipIf(caseSensitive())('says a folder that differs only in case, found here and not on Linux', () => {
    fs.rmSync(path.join(root, 'src/data'), { recursive: true });
    write('src/Data/x.json', '{}');

    const said = only('folder-near-miss');

    expect(said.message).toContain('did you mean src/data/?');
    expect(said.message).toContain('not on Linux');
    expect(said.fix).toBe('Rename it: git mv src/Data src/Data-tmp && git mv src/Data-tmp src/data');
  });

  it('reads no data folder in a project with no server', () => {
    write('package.json', '{}');
    write('data/x.json', '{}');
    write('src/data/notes.txt');

    expect(codes(checkProjectLayout(root))).toEqual([]);
  });
});

describe('the settings', () => {
  it('refuses a .env in src/, moved to the root when it has none', () => {
    fs.rmSync(path.join(root, '.env'));
    write('src/.env', 'A=1\n');

    expect(checkProjectLayout(root).filter(each => each.file.includes('.env'))).toEqual([
      expect.objectContaining({
        code: 'env-in-src',
        level: 'error',
        message:
          "src/.env is never read: Node reads the project's settings from the .env at its root, as its scripts start it (--env-file-if-exists=.env).",
        fix: 'Move it to the root: mv src/.env .env',
        autofix: { action: 'move', from: 'src/.env', to: '.env' }
      })
    ]);

    write('.env', 'B=2\n');
    expect(only('env-in-src')).toMatchObject({ fix: "Copy what it sets into the root's .env, then delete src/.env." });
    expect(only('env-in-src').autofix).toBeUndefined();
  });

  it('warns of no .env — copied from .env.example — and of no .env.example — written from .env, no value kept', () => {
    fs.rmSync(path.join(root, '.env'));
    expect(only('env-missing')).toMatchObject({
      level: 'warning',
      autofix: { action: 'copy', from: '.env.example', to: '.env' }
    });

    write('.env', '# the key\nPLITZI_SIGNING_SECRET=abc123\nexport REDIS_URL="redis://x"\n');
    fs.rmSync(path.join(root, '.env.example'));
    expect(only('env-example-missing').autofix).toEqual({
      action: 'write',
      file: '.env.example',
      contents: '# the key\nPLITZI_SIGNING_SECRET=\nexport REDIS_URL=\n'
    });
  });
});

describe('the data and what is public', () => {
  it('warns of a file of src/data/ that is not JSON', () => {
    write('src/data/notes.txt');
    write('src/data/README.md');

    expect(only('data-not-json')).toMatchObject({ level: 'warning', file: 'src/data/notes.txt' });
  });

  it('warns of JSON in public/data/ of a project with a server, and not of one without', () => {
    write('public/data/prices.json', '{}');
    write('public/data/plans.json', '{}');

    expect(only('public-data').message).toBe(
      'public/data/ holds 2 JSON files (plans.json, prices.json), served to anyone who asks: every visitor can read all of them, not only what a page shows.'
    );
    expect(codes(checkProjectLayout(root, { mode: 'client' }))).not.toContain('public-data');
  });

  it('warns of a file in public/ named like a secret, whatever the project', () => {
    write('public/.env');
    write('public/keys/server.pem');
    write('public/backup.sql');
    write('public/images/secret-santa.png');

    expect(
      checkProjectLayout(root, { mode: 'client' })
        .filter(each => each.code === 'public-secret-file')
        .map(each => each.file)
    ).toEqual(['public/.env', 'public/backup.sql', 'public/images/secret-santa.png', 'public/keys/server.pem']);
  });
});

describe('refusing a layout', () => {
  it('lists every error at once — never the first alone — and answers the warnings', () => {
    write('src/plugins/Card/declaration.ts');
    write('src/plugins/story-editor/index.ts');
    write('src/plugins/Card/notes.txt');
    write('src/data/notes.txt');

    let refused: unknown;
    try {
      assertProjectLayout(root);
    } catch (error) {
      refused = error;
    }

    expect(refused).toBeInstanceOf(ProjectLayoutError);
    const error = refused as ProjectLayoutError;
    expect(codes(error.findings)).toEqual(['plugin-entry-missing', 'plugin-name-invalid']);
    expect(error.message).toMatch(
      /^The project is not laid out as Plitzi reads it — 2 errors:\n\n1\. src\/plugins\/Card\//
    );
    expect(error.message).toContain('\n\n2. src/plugins/story-editor/ cannot be a plugin');
    expect(error.message).toContain('\n   → Rename it StoryEditor');
    expect(error.message.endsWith('npx plitzi doctor says these with the rest of the project.')).toBe(true);
    // Nothing beside the message: a process that ends on it prints the error's own fields too.
    expect(Object.keys(error)).not.toContain('findings');
    // Named so however a bundler renames the class it inlines: what a process that ends on it prints.
    expect(ProjectLayoutError.name).toBe('ProjectLayoutError');

    fs.rmSync(path.join(root, 'src/plugins'), { recursive: true });
    expect(codes(assertProjectLayout(root))).toEqual(['data-not-json']);
  });

  it('says how many of them doctor --fix makes', () => {
    write('src/plugins/Card/index.js');
    write('src/plugins/Card/declaration.ts');

    expect(() => assertProjectLayout(root)).toThrow('npx plitzi doctor --fix makes these fixes itself.');
  });
});
