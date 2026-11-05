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
        "import { formatDate, isRecord, type SupportedLocale } from '@plitzi/sdk-shared/helpers';",
        ''
      ].join('\n')
    );

    const said = await run(false);
    expect(said.map(found => [found.line, found.writable, found.written])).toEqual([
      [1, true, false],
      [2, true, false],
      [4, true, false]
    ]);
    expect(said[0].what).toBe('PROJECT_DATA_PREFIX is imported from `@plitzi/sdk-shared/project/paths` now');

    await run(true);
    expect(await read('src/a.ts')).toBe(
      [
        "import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/project/paths';",
        "import { refreshRsc } from '@plitzi/sdk-shared/server';",
        "import { PROJECT_DATA_PREFIX as PREFIX } from '@plitzi/sdk-shared/project/paths';",
        "import { refreshRsc as again } from '@plitzi/sdk-shared/server';",
        "import { isRecord } from '@plitzi/sdk-shared/helpers';",
        "import { formatDate, type SupportedLocale } from '@plitzi/sdk-shared/dates';",
        ''
      ].join('\n')
    );
    expect(await run(false)).toEqual([]);
  });

  it('imports what the page server re-exported of the kernel from the kernel', async () => {
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    await fs.symlink(typescriptDir, path.join(root, 'node_modules', 'typescript'), 'dir');
    await write(
      'src/server.ts',
      [
        "import { closeOnSignals, consoleLogger, createServer } from '@plitzi/sdk-server';",
        "import { createAuth, generateTokenKeys } from '@plitzi/sdk-server/auth';",
        "import type { SSRContext, Stage } from '@plitzi/sdk-server/kernel';",
        ''
      ].join('\n')
    );

    await run(true);
    expect(await read('src/server.ts')).toBe(
      [
        "import { createServer } from '@plitzi/sdk-server';",
        "import { closeOnSignals } from '@plitzi/sdk-kernel/http';",
        "import { consoleLogger } from '@plitzi/sdk-kernel/log';",
        "import { createAuth } from '@plitzi/sdk-server/auth';",
        "import { generateTokenKeys } from '@plitzi/sdk-kernel/tokens';",
        "import type { SSRContext } from '@plitzi/sdk-server';",
        "import type { Stage } from '@plitzi/sdk-kernel/http';",
        ''
      ].join('\n')
    );
  });

  it('imports the contract a space’s code is written against from sdk-runtime, the host’s from sdk-actions', async () => {
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    await fs.symlink(typescriptDir, path.join(root, 'node_modules', 'typescript'), 'dir');
    await write(
      'src/functions/index.ts',
      [
        "import { ActionRefusal, defineFunctions } from '@plitzi/sdk-server/functions';",
        "import type { FunctionsConfig, FunctionTask } from '@plitzi/sdk-server/functions';",
        "import { defineRuntime, serveRuntime } from '@plitzi/sdk-server/runtime';",
        ''
      ].join('\n')
    );

    await run(true);
    expect(await read('src/functions/index.ts')).toBe(
      [
        "import { ActionRefusal, defineFunctions } from '@plitzi/sdk-runtime';",
        "import type { FunctionsConfig } from '@plitzi/sdk-actions/functions';",
        "import type { FunctionTask } from '@plitzi/sdk-runtime';",
        "import { defineRuntime } from '@plitzi/sdk-runtime';",
        "import { serveRuntime } from '@plitzi/sdk-actions/runtimes';",
        ''
      ].join('\n')
    );
  });

  it('says where, without writing, in a project with no TypeScript', async () => {
    const source = "import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server';\n";
    await write('src/b.ts', source);

    const [found] = await run(true);
    expect(found).toMatchObject({ line: 1, writable: false, written: false });
    expect(await read('src/b.ts')).toBe(source);
  });

  it('says only what an import names, not the same word elsewhere, in a project with no TypeScript', async () => {
    await write(
      'src/c.ts',
      ["import { serverLog } from '@plitzi/sdk-server';", "const Stage = 'a word, not the kernel’s type';", ''].join(
        '\n'
      )
    );

    const said = await run(false);
    expect(said.map(found => [found.line, found.what])).toEqual([
      [
        1,
        'serverLog is imported from `@plitzi/sdk-kernel/log` now (the project installs no TypeScript to read the import with)'
      ]
    ]);
  });
});
