import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { pinnedNow } from './run';

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
