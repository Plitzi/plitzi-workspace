/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { folderImports } from './folderImports';

describe('folderImports', () => {
  let root = '';

  /** A package installed as `exports` says — with its folders (`"./*"`) or not — and the folders its `dist` has. */
  const install = async (name: string, exportsFolders: boolean, folders: string[]) => {
    const installed = path.join(root, 'node_modules', name);
    await fs.mkdir(installed, { recursive: true });
    await fs.writeFile(
      path.join(installed, 'package.json'),
      JSON.stringify({ name, exports: exportsFolders ? { '.': {}, './*': {} } : { '.': {}, './helpers/isRecord': {} } })
    );
    for (const folder of folders) {
      await fs.mkdir(path.join(installed, 'dist', folder), { recursive: true });
      await fs.writeFile(path.join(installed, 'dist', folder, 'index.d.ts'), 'export {};\n');
    }
  };

  const find = (text: string) => folderImports.start({ root, lastUpgraded: undefined })({ file: 'src/a.ts', text });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-folder-imports-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('names the folder a file import comes from, or the root for a file at the top', async () => {
    await install('@plitzi/sdk-shared', true, ['helpers']);

    const places = await find(
      [
        "import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';",
        "import { canonicalJson } from '@plitzi/sdk-shared/helpers';",
        "import { version } from '@plitzi/sdk-shared/version';"
      ].join('\n')
    );

    expect(places).toEqual([
      { line: 1, what: expect.stringContaining('`@plitzi/sdk-shared/helpers`') as unknown },
      { line: 3, what: expect.stringContaining('`@plitzi/sdk-shared`') as unknown }
    ]);
  });

  it('says nothing of a package still installed in its old shape', async () => {
    await install('@plitzi/sdk-shared', false, []);

    expect(await find("import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';")).toEqual([]);
  });
});
