import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { platformServer } from './platformServer';
import { runMigrations } from '../run';

const typescriptDir = path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'));

describe('platformServer', () => {
  let root = '';
  const write = (file: string, text: string) =>
    fs
      .mkdir(path.dirname(path.join(root, file)), { recursive: true })
      .then(() => fs.writeFile(path.join(root, file), text));
  const read = (file: string) => fs.readFile(path.join(root, file), 'utf-8');
  const run = (writeIt: boolean) =>
    runMigrations({ root, lastUpgraded: undefined }, [platformServer], { write: writeIt });

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-platform-server-'));
    await write('package.json', '{}');
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    await fs.symlink(typescriptDir, path.join(root, 'node_modules', 'typescript'), 'dir');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('composes pages and actions with createPlatform, keeping createServer where it serves pages alone', async () => {
    await write(
      'src/main.ts',
      [
        "import { createJsonAdapters, createServer } from '@plitzi/sdk-server';",
        '',
        'const adapters = createJsonAdapters({ offlineData: {} });',
        'const site = createServer({ adapters, action: { lookups } });',
        'const docs = createServer({ adapters });',
        ''
      ].join('\n')
    );

    const said = await run(false);
    expect(said.map(found => found.line)).toEqual([4, 1]);

    await run(true);
    expect(await read('src/main.ts')).toBe(
      [
        "import { createJsonAdapters, createServer } from '@plitzi/sdk-server';",
        "import { createPlatform } from '@plitzi/sdk-server/platform';",
        '',
        'const adapters = createJsonAdapters({ offlineData: {} });',
        'const site = createPlatform({ adapters, action: { lookups } });',
        'const docs = createServer({ adapters });',
        ''
      ].join('\n')
    );
    expect(await run(false)).toEqual([]);
  });

  it('drops createServer from the import when no call is left of it', async () => {
    await write(
      'src/main.ts',
      "import { createServer } from '@plitzi/sdk-server';\n\ncreateServer({ adapters, realtime: false });\n"
    );

    await run(true);
    expect(await read('src/main.ts')).toBe(
      "import { createPlatform } from '@plitzi/sdk-server/platform';\n\ncreatePlatform({ adapters, realtime: false });\n"
    );
  });

  it('says a configuration it cannot read where the call is, and writes nothing', async () => {
    const source = "import { createServer } from '@plitzi/sdk-server';\n\ncreateServer(config);\n";
    await write('src/main.ts', source);

    const [found] = await run(true);
    expect(found).toMatchObject({ line: 3, writable: false, written: false });
    expect(await read('src/main.ts')).toBe(source);
  });
});
