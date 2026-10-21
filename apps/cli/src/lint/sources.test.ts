import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readSpaceSources } from './sources';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-sources-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const write = async (file: string, text: string): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};

describe('the space’s source, followed from its entry', () => {
  it('goes through a folder of pages loaded by convention, and still finds a file nothing reaches', async () => {
    await write(
      'src/space/index.ts',
      "import { pagesIn } from '@plitzi/sdk-authoring/node';\n\nexport const space = { pages: await pagesIn(new URL('./pages/', import.meta.url)) };\n"
    );
    await write('src/space/pages/pets.ts', "export default { name: 'Pets', slug: 'pets', body: [] };\n");
    await write(
      'src/space/pages/home/index.ts',
      "import { hero } from './hero.ts';\n\nexport default { body: [hero] };\n"
    );
    await write('src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await write('src/space/old.ts', 'export const old = 1;\n');

    const { files, unreached } = await readSpaceSources(ts, {
      root,
      entry: 'src/space/index.ts',
      spaceDir: 'src/space',
      excluded: []
    });

    expect(files.map(file => file.file).sort()).toEqual([
      path.join('src/space/index.ts'),
      path.join('src/space/pages/home/hero.ts'),
      path.join('src/space/pages/home/index.ts'),
      path.join('src/space/pages/pets.ts')
    ]);
    expect(unreached).toEqual([path.join('src/space/old.ts')]);
  });
});
