/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { movedExports } from './movedExports';
import { runMigrations } from '../run';

const typescriptDir = path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'));

describe('movedExports', () => {
  let root = '';
  const write = (file: string, text: string) =>
    fs
      .mkdir(path.dirname(path.join(root, file)), { recursive: true })
      .then(() => fs.writeFile(path.join(root, file), text));
  const read = (file: string) => fs.readFile(path.join(root, file), 'utf-8');
  const run = (writeIt: boolean) =>
    runMigrations({ root, lastUpgraded: undefined }, [movedExports], { write: writeIt });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-moved-exports-'));
    await write('package.json', '{}');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('imports a moved name from where it lives now, splitting it from what stayed', async () => {
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    await fs.symlink(typescriptDir, path.join(root, 'node_modules', 'typescript'), 'dir');
    await write(
      'src/a.ts',
      [
        "import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server';",
        "import { refreshRsc, PROJECT_DATA_PREFIX as PREFIX } from '@plitzi/sdk-shared/server';",
        "import { refreshRsc as again } from '@plitzi/sdk-shared/server';",
        ''
      ].join('\n')
    );

    const said = await run(false);
    expect(said.map(found => [found.line, found.writable, found.written])).toEqual([
      [1, true, false],
      [2, true, false]
    ]);
    expect(said[0].what).toBe('PROJECT_DATA_PREFIX is imported from `@plitzi/sdk-shared/project/paths` now');

    await run(true);
    expect(await read('src/a.ts')).toBe(
      [
        "import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/project/paths';",
        "import { refreshRsc } from '@plitzi/sdk-shared/server';",
        "import { PROJECT_DATA_PREFIX as PREFIX } from '@plitzi/sdk-shared/project/paths';",
        "import { refreshRsc as again } from '@plitzi/sdk-shared/server';",
        ''
      ].join('\n')
    );
    expect(await run(false)).toEqual([]);
  });

  it('says where, without writing, in a project with no TypeScript', async () => {
    const source = "import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server';\n";
    await write('src/b.ts', source);

    const [found] = await run(true);
    expect(found).toMatchObject({ line: 1, writable: false, written: false });
    expect(await read('src/b.ts')).toBe(source);
  });
});
