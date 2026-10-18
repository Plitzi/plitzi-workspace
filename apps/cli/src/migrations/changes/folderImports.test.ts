/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { folderImports } from './folderImports';
import { runMigrations } from '../run';

/** What a package installs in its folder shape: a barrel per folder, re-exporting its files as the build writes them. */
const DECLARATIONS: Record<string, string> = {
  'index.d.ts': 'export * from "./types";\n',
  'types.d.ts': 'export type Version = string;\n',
  'version.d.ts': 'export declare const version = "1";\n',
  'helpers/index.d.ts': 'export * from "./isRecord";\nexport * from "./cookies";\n',
  'helpers/isRecord.d.ts': 'export declare const isRecord: (value: unknown) => value is Record<string, unknown>;\n',
  'helpers/cookies.d.ts': 'export type Cookie = { name: string };\nexport declare const readCookie: () => Cookie;\n',
  'hooks/index.d.ts': [
    "import { default as usePlitzi } from './usePlitzi';",
    "import { default as useTwice } from './useTwice';",
    "export * from './usePlitzi';",
    'export { usePlitzi, useTwice, useTwice as useAgain };',
    ''
  ].join('\n'),
  'hooks/usePlitzi.d.ts': [
    'export type PlitziValue = { id: string };',
    'declare const usePlitzi: () => PlitziValue;',
    'export default usePlitzi;',
    ''
  ].join('\n'),
  'hooks/useTwice.d.ts': 'declare const useTwice: () => void;\nexport default useTwice;\n'
};

const typescriptDir = path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'));

describe('folderImports', () => {
  let root = '';
  const write = (file: string, text: string) =>
    fs
      .mkdir(path.dirname(path.join(root, file)), { recursive: true })
      .then(() => fs.writeFile(path.join(root, file), text));
  const read = (file: string) => fs.readFile(path.join(root, file), 'utf-8');

  /** A package installed as `exports` says — with its folders (`"./*"`) or not — with its declarations. */
  const install = async (exportsFolders = true) => {
    await write(
      'node_modules/@plitzi/sdk-shared/package.json',
      JSON.stringify({
        name: '@plitzi/sdk-shared',
        exports: exportsFolders ? { '.': {}, './*': {} } : { '.': {}, './helpers/isRecord': {} }
      })
    );
    for (const [file, text] of Object.entries(DECLARATIONS)) {
      await write(`node_modules/@plitzi/sdk-shared/dist/${file}`, text);
    }
  };

  /** The project's own TypeScript, which is what reads the names: linked, as an install would have it. */
  const installTypeScript = () => fs.symlink(typescriptDir, path.join(root, 'node_modules', 'typescript'), 'dir');

  const run = (writeIt: boolean) =>
    runMigrations({ root, lastUpgraded: undefined }, [folderImports], { write: writeIt });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-folder-imports-'));
    await write('package.json', '{}');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes each import whose names the folder gives one name, as the folder names them', async () => {
    await install();
    await installTypeScript();
    await write(
      'src/a.ts',
      [
        "import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';",
        'import type { Cookie } from "@plitzi/sdk-shared/helpers/cookies";',
        "import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';",
        "import useMine, { type PlitziValue } from '@plitzi/sdk-shared/hooks/usePlitzi'",
        "import { canonicalJson } from '@plitzi/sdk-shared/helpers';",
        "import { version } from '@plitzi/sdk-shared/version';",
        "export { isRecord as isObject } from '@plitzi/sdk-shared/helpers/isRecord';",
        ''
      ].join('\n')
    );

    const said = await run(false);
    expect(said.map(found => [found.line, found.written])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
      [6, false],
      [7, false]
    ]);
    expect(said[0].what).toContain('`@plitzi/sdk-shared/helpers`');

    const written = await run(true);
    expect(written.map(found => [found.line, found.written])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, true],
      [6, false],
      [7, true]
    ]);
    // The root exports the document types alone: `version` is the author's to find a home for.
    expect(written[4].what).toContain('(the folder exports no name for its `version`)');
    expect(await read('src/a.ts')).toBe(
      [
        "import { isRecord } from '@plitzi/sdk-shared/helpers';",
        'import type { Cookie } from "@plitzi/sdk-shared/helpers";',
        "import { usePlitzi } from '@plitzi/sdk-shared/hooks';",
        "import { usePlitzi as useMine, type PlitziValue } from '@plitzi/sdk-shared/hooks'",
        "import { canonicalJson } from '@plitzi/sdk-shared/helpers';",
        "import { version } from '@plitzi/sdk-shared/version';",
        "export { isRecord as isObject } from '@plitzi/sdk-shared/helpers';",
        ''
      ].join('\n')
    );
    expect((await run(false)).map(found => found.line)).toEqual([6]);
  });

  it('says, and leaves, what has no one answer — with why', async () => {
    await install();
    await installTypeScript();
    const source = [
      "import * as helpers from '@plitzi/sdk-shared/helpers/isRecord';",
      "import useTwice from '@plitzi/sdk-shared/hooks/useTwiceOver';",
      "import { missing } from '@plitzi/sdk-shared/helpers/isRecord';",
      "vi.mock('@plitzi/sdk-shared/helpers/isRecord');",
      ''
    ].join('\n');
    await write('src/b.ts', source);

    const found = await run(true);
    expect(found.map(each => [each.line, each.written, /\(([^)]*)\)$/.exec(each.what)?.[1]])).toEqual([
      [1, false, 'a namespace import: the folder holds more than the file did'],
      [2, false, '@plitzi/sdk-shared installs no declarations for `hooks/useTwiceOver` to read its names from'],
      [3, false, 'the file exports no `missing`'],
      [4, false, 'not an `import` or `export … from`']
    ]);
    expect(await read('src/b.ts')).toBe(source);
  });

  it('chooses the file’s own name when the folder exports its default twice, and says when neither is', async () => {
    await install();
    await installTypeScript();
    await write('src/c.ts', "import twice from '@plitzi/sdk-shared/hooks/useTwice';\n");

    await run(true);
    expect(await read('src/c.ts')).toBe("import { useTwice as twice } from '@plitzi/sdk-shared/hooks';\n");
  });

  it('says every one without writing in a project with no TypeScript to read the names with', async () => {
    await install();
    await write('src/d.ts', "import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';\n");

    const [found] = await run(true);
    expect(found).toMatchObject({ line: 1, written: false });
    expect(found.what).toContain('the project installs no TypeScript');
  });

  it('says nothing of a package still installed in its old shape', async () => {
    await install(false);
    await installTypeScript();
    await write('src/e.ts', "import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';\n");

    expect(await run(true)).toEqual([]);
  });
});
