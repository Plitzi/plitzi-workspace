/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { pluginDeclarations, projectData, publicData } from './node';

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
