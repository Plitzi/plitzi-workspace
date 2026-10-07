/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectLayoutError } from '@plitzi/sdk-shared/project/layout';

import { authorSpace } from '.';
import {
  authorProjectSpace,
  pluginDeclarations,
  projectAuthoring,
  projectAuthoringAt,
  projectData,
  ProjectSpaceError,
  projectSpaceAt,
  publicData
} from './node';

const root = mkdtempSync(path.join(tmpdir(), 'plitzi-public-data-'));
mkdirSync(path.join(root, 'public/data'), { recursive: true });
writeFileSync(path.join(root, 'public/data/plans.json'), JSON.stringify({ plans: [{ name: 'Starter' }] }));
writeFileSync(path.join(root, 'public/data/broken.json'), '{ plans');
writeFileSync(path.join(root, 'secret.json'), '{}');

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('publicData', () => {
  const answer = publicData(path.join(root, 'public'));

  it('answers a query that is a JSON file the project serves', () => {
    expect(answer('/data/plans.json')).toEqual({ plans: [{ name: 'Starter' }] });
    expect(answer('/data/plans.json?v=2')).toEqual({ plans: [{ name: 'Starter' }] });
  });

  it('answers nothing it cannot read as the server would serve it', () => {
    expect(answer('https://example.com/data/plans.json')).toBeUndefined();
    expect(answer('/data/{{ navigation.routeParams.id }}.json')).toBeUndefined();
    expect(answer('/../secret.json')).toBeUndefined();
    expect(answer('/data/missing.json')).toBeUndefined();
    expect(answer('/data/broken.json')).toBeUndefined();
  });
});

describe('projectData', () => {
  const answer = projectData(path.join(root, 'public/data'));

  it('answers `/data/<file>` from the folder the server reads it from', () => {
    expect(answer('/data/plans.json')).toEqual({ plans: [{ name: 'Starter' }] });
  });

  it('answers nothing outside `/data/`, nor out of its folder', () => {
    expect(answer('/plans.json')).toBeUndefined();
    expect(answer('/data/../secret.json')).toBeUndefined();
    expect(answer('/data/../../secret.json')).toBeUndefined();
  });
});

describe('pluginDeclarations', () => {
  const plugins = path.join(root, 'src/plugins');
  mkdirSync(path.join(plugins, 'Board'), { recursive: true });
  mkdirSync(path.join(plugins, 'Avatar'), { recursive: true });
  mkdirSync(path.join(plugins, 'Plain'), { recursive: true });
  writeFileSync(path.join(plugins, 'Board/declaration.ts'), "export default { type: 'board', triggers: {} };\n");
  writeFileSync(path.join(plugins, 'Avatar/declaration.ts'), "export default { type: 'avatar' };\n");
  writeFileSync(path.join(plugins, 'Plain/index.ts'), 'export default {};\n');

  it('is every plugin folder’s declaration, found by folder, in folder order', async () => {
    expect((await pluginDeclarations(plugins)).map(declaration => declaration.type)).toEqual(['avatar', 'board']);
  });

  it('is none where there is no folder of plugins', async () => {
    expect(await pluginDeclarations(path.join(root, 'nowhere'))).toEqual([]);
  });

  it('refuses a declaration file with no declaration, naming it', async () => {
    mkdirSync(path.join(plugins, 'Broken'), { recursive: true });
    writeFileSync(path.join(plugins, 'Broken/declaration.ts'), 'export const type = 1;\n');

    await expect(pluginDeclarations(plugins)).rejects.toThrow(/Broken\/declaration\.ts exports no declaration/);
  });
});

describe('projectAuthoring', () => {
  const project = mkdtempSync(path.join(tmpdir(), 'plitzi-project-authoring-'));
  writeFileSync(path.join(project, 'package.json'), '{}\n');
  mkdirSync(path.join(project, 'src/space'), { recursive: true });
  writeFileSync(path.join(project, 'src/space/index.ts'), 'export const space = {};\n');
  mkdirSync(path.join(project, 'src/plugins/Board'), { recursive: true });
  writeFileSync(path.join(project, 'src/plugins/Board/index.ts'), 'export default () => null;\n');
  writeFileSync(path.join(project, 'src/plugins/Board/declaration.ts'), "export default { type: 'board' };\n");
  mkdirSync(path.join(project, 'src/data'), { recursive: true });
  writeFileSync(path.join(project, 'src/data/products.json'), JSON.stringify({ items: [{ name: 'Lamp' }] }));
  mkdirSync(path.join(project, 'public/data'), { recursive: true });
  writeFileSync(path.join(project, 'public/data/plans.json'), JSON.stringify({ plans: [] }));
  for (const [type, manifest] of [
    ['chart', { pluginSchema: { chart: {}, chartLegend: {} } }],
    ['map', { version: '2.0.0' }]
  ] as const) {
    mkdirSync(path.join(project, 'vendor/plugins', type), { recursive: true });
    writeFileSync(
      path.join(project, 'vendor/plugins', type, 'plugin-manifest.json'),
      JSON.stringify({ ...manifest, assets: { js: { src: `${type}.mjs`, type: 'script', isMain: true } } })
    );
    writeFileSync(path.join(project, 'vendor/plugins', type, `${type}.mjs`), '');
  }

  afterAll(() => {
    rmSync(project, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The process as a project's script starts it: in the project's root. */
  const runIn = (folder: string): void => {
    vi.spyOn(process, 'cwd').mockReturnValue(folder);
  };

  it('is what the project says: its declarations, the built plugins’ types and the data its providers read', async () => {
    runIn(project);
    const options = await projectAuthoring();

    expect(options.plugins.map(declaration => declaration.type)).toEqual(['board']);
    // Each built folder's type and every element its manifest provides.
    expect(options.pluginTypes).toEqual(['chart', 'chart', 'chartLegend', 'map']);
    expect(options.serverData?.('/data/products.json')).toEqual({ items: [{ name: 'Lamp' }] });
    expect(options.data('/data/plans.json')).toEqual({ plans: [] });
  });

  // `node main.ts` in `src/`, or a script run from the folder above: never guessed from where a file is.
  it('refuses a process started anywhere but the project’s root, saying what is missing and where to run it', async () => {
    runIn(path.join(project, 'src'));

    await expect(projectAuthoring()).rejects.toThrow(
      `${path.join(project, 'src')} is not the root of a Plitzi project: it has no package.json and no src/. Run it from the project's root`
    );
  });

  it('reads a project found from another folder — the CLI’s — held to the same check', async () => {
    runIn(tmpdir());

    expect((await projectAuthoringAt(project)).plugins.map(declaration => declaration.type)).toEqual(['board']);
    await expect(projectAuthoringAt(path.join(project, 'public'))).rejects.toThrow(
      'is not the root of a Plitzi project'
    );
  });

  // What the server would not build, run or read is refused before the space is: every error at once.
  it('refuses a project laid out where nothing reads it, every error said — as its server and the doctor say it', async () => {
    const broken = mkdtempSync(path.join(tmpdir(), 'plitzi-project-authoring-broken-'));
    mkdirSync(path.join(broken, 'src/plugins/Card'), { recursive: true });
    mkdirSync(path.join(broken, 'src/plugin/Chart'), { recursive: true });
    writeFileSync(path.join(broken, 'package.json'), '{}\n');
    writeFileSync(path.join(broken, 'src/plugin/Chart/index.ts'), '');
    writeFileSync(path.join(broken, 'src/.env'), 'A=1\n');
    try {
      const refused = projectAuthoringAt(broken);

      await expect(refused).rejects.toBeInstanceOf(ProjectLayoutError);
      await expect(refused).rejects.toThrow(
        /^The project is not laid out as Plitzi reads it — 4 errors:\n\n1\. src\/plugins\/Card\/ has no index\.ts/
      );
      await expect(refused).rejects.toThrow('2. src/space/ has no index.ts');
      await expect(refused).rejects.toThrow('3. src/plugin/ holds src/plugin/Chart/index.ts');
      await expect(refused).rejects.toThrow('4. src/.env is never read');
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });

  it('checks against nothing a project does not have — and a project with no server reads no data of its own', async () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'plitzi-project-authoring-empty-'));
    writeFileSync(path.join(empty, 'package.json'), '{}\n');
    mkdirSync(path.join(empty, 'src/space'), { recursive: true });
    writeFileSync(path.join(empty, 'src/space/index.ts'), 'export const space = {};\n');
    try {
      const options = await projectAuthoringAt(empty);

      expect(options.plugins).toEqual([]);
      expect(options.pluginTypes).toEqual([]);
      expect(options).not.toHaveProperty('serverData');
      expect(options.data('/data/plans.json')).toBeUndefined();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('is options `authorSpace` takes whole', async () => {
    const authored = authorSpace(
      { name: 'Shop', permanentUrl: 'shop', pages: [{ name: 'Home', slug: '', body: [] }] },
      await projectAuthoringAt(project)
    );

    expect(authored.schema.definition.permanentUrl).toBe('shop');
  });
});

describe('projectSpace', () => {
  /** A project whose space module is `source`, in a folder of its own: a module is imported once per path. */
  const projectWith = (source: string): string => {
    const folder = mkdtempSync(path.join(tmpdir(), 'plitzi-project-space-'));
    writeFileSync(path.join(folder, 'package.json'), '{}\n');
    mkdirSync(path.join(folder, 'src/space'), { recursive: true });
    writeFileSync(path.join(folder, 'src/space/index.ts'), source);

    return folder;
  };
  const folders: string[] = [];

  afterAll(() => {
    folders.forEach(folder => {
      rmSync(folder, { recursive: true, force: true });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is the space src/space/index.ts exports, with what it is checked against', async () => {
    const folder = projectWith(
      "export const space = { name: 'Shop', permanentUrl: 'shop', pages: [{ name: 'Home', slug: '', body: [] }] };\n"
    );
    folders.push(folder);
    const { space, authoring } = await projectSpaceAt(folder);

    expect(space.permanentUrl).toBe('shop');
    expect(authoring.plugins).toEqual([]);
  });

  it('is authored whole for the project the process runs in — what its server serves', async () => {
    const folder = projectWith(
      "export const space = { name: 'Shop', permanentUrl: 'shop', pages: [{ name: 'Home', slug: '', body: [] }] };\n"
    );
    folders.push(folder);
    vi.spyOn(process, 'cwd').mockReturnValue(folder);

    expect((await authorProjectSpace()).schema.definition.permanentUrl).toBe('shop');
  });

  // An export renamed or forgotten: said as what to export, not as `undefined` read three calls later.
  it('refuses a space module that exports no space, saying what to export', async () => {
    const folder = projectWith("export const site = { name: 'Shop' };\n");
    folders.push(folder);
    const refused = projectSpaceAt(folder);

    await expect(refused).rejects.toBeInstanceOf(ProjectSpaceError);
    await expect(refused).rejects.toThrow(
      "src/space/index.ts exports no `space`: the space's declaration, `export const space: SpaceSpec = { name, permanentUrl, pages, … }`"
    );
  });

  it('holds the layout first: a space folder with no index.ts is said as that, not as a module not found', async () => {
    const folder = projectWith('');
    folders.push(folder);
    rmSync(path.join(folder, 'src/space/index.ts'));

    await expect(projectSpaceAt(folder)).rejects.toBeInstanceOf(ProjectLayoutError);
  });
});
