import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from './run';
import { template } from './template';

/**
 * THE TEMPLATE FOR A MIGRATION'S TEST, copied beside the migration in `changes/` (`runMigrations` from `../run`): what
 * it finds, what it leaves alone, and — for places with an `edit` — what `--write` makes of the file, through
 * `runMigrations` as `plitzi upgrade migrations` runs it.
 */
describe('template', () => {
  let root = '';
  const write = (file: string, text: string) =>
    fs
      .mkdir(path.dirname(path.join(root, file)), { recursive: true })
      .then(() => fs.writeFile(path.join(root, file), text));
  const read = (file: string) => fs.readFile(path.join(root, file), 'utf-8');

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-example-migration-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('finds the old name where the package’s is imported, and rewrites it only when asked', async () => {
    const source = "import { oldName } from '@plitzi/sdk-example';\n\nexport const value = oldName();\n";
    await write('src/space/value.ts', source);

    const shown = await runMigrations({ root, lastUpgraded: undefined }, [template], { write: false });
    expect(shown).toEqual([
      expect.objectContaining({ migration: 'template', file: path.join('src', 'space', 'value.ts'), line: 1 }),
      expect.objectContaining({ line: 3, written: false })
    ]);
    expect(await read('src/space/value.ts')).toBe(source);

    await runMigrations({ root, lastUpgraded: undefined }, [template], { write: true });
    expect(await read('src/space/value.ts')).toBe(
      "import { newName } from '@plitzi/sdk-example';\n\nexport const value = newName();\n"
    );
  });

  it('leaves a name of the project’s own that only happens to be spelled the same', async () => {
    const own = 'export const oldName = () => 1;\n';
    await write('src/space/own.ts', own);

    expect(await runMigrations({ root, lastUpgraded: undefined }, [template], { write: true })).toEqual([]);
    expect(await read('src/space/own.ts')).toBe(own);
  });
});
