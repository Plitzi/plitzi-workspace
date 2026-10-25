import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { pinDifference, pinnedNow } from './run';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

// la-velada: read while npm installed, the run saw its staging folders as packages — every package "none" — and was
// told Plitzi changed under it.
describe('pinnedNow', () => {
  it('pins the @plitzi packages installed, never npm’s staging folders nor a manifest half written', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pinned-'));
    roots.push(root);
    const write = async (name: string, text: string) => {
      await fs.mkdir(path.join(root, 'node_modules/@plitzi', name), { recursive: true });
      await fs.writeFile(path.join(root, 'node_modules/@plitzi', name, 'package.json'), text);
    };
    await write('cli', '{ "version": "0.38.24" }');
    await write('.cli-4Vu260qW', '{ "version": "0.38.24" }');
    await write('sdk-shared', '{ "version": "0.38');

    expect(await pinnedNow(root, '0.38.24')).toEqual({ cli: '0.38.24', packages: { '@plitzi/cli': '0.38.24' } });
  });
});

// encore-3: a plitzi-ui patch under the SDK refused every agent's command until a person attached again.
describe('pinDifference', () => {
  const pin = (packages: Record<string, string>) => ({ cli: '0.38.24', packages });

  it('stops on a package the project names, and only says one that comes with them', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pinned-'));
    roots.push(root);
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@plitzi/plitzi-sdk': '^0.38.24' }, devDependencies: { react: '^19.2.8' } })
    );
    const was = pin({ '@plitzi/plitzi-sdk': '0.38.24', '@plitzi/plitzi-ui': '1.6.34' });

    expect(
      await pinDifference(root, was, pin({ '@plitzi/plitzi-sdk': '0.38.24', '@plitzi/plitzi-ui': '1.6.35' }))
    ).toEqual({
      stops: [],
      carried: ['@plitzi/plitzi-ui 1.6.34 → 1.6.35']
    });
    expect(
      await pinDifference(root, was, pin({ '@plitzi/plitzi-sdk': '0.38.25', '@plitzi/plitzi-ui': '1.6.34' }))
    ).toEqual({
      stops: ['@plitzi/plitzi-sdk 0.38.24 → 0.38.25'],
      carried: []
    });
    expect((await pinDifference(root, was, { ...was, cli: '0.38.25' })).stops).toEqual([
      '@plitzi/cli 0.38.24 → 0.38.25'
    ]);
  });

  it('stops on any change when the project’s package.json cannot be read', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pinned-'));
    roots.push(root);

    expect(
      await pinDifference(root, pin({ '@plitzi/plitzi-ui': '1.6.34' }), pin({ '@plitzi/plitzi-ui': '1.6.35' }))
    ).toEqual({ stops: ['@plitzi/plitzi-ui 1.6.34 → 1.6.35'], carried: [] });
  });
});
