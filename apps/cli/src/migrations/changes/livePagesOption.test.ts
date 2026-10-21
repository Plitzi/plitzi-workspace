import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { livePagesOption } from './livePagesOption';
import { runMigrations } from '../run';

describe('livePagesOption', () => {
  let root = '';
  const write = (file: string, text: string) =>
    fs
      .mkdir(path.dirname(path.join(root, file)), { recursive: true })
      .then(() => fs.writeFile(path.join(root, file), text));
  const read = (file: string) => fs.readFile(path.join(root, file), 'utf-8');

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-live-pages-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('renames the option where the server is imported, and only when asked', async () => {
    const source = [
      "import type { ProjectServerOptions } from '@plitzi/sdk-server/project';",
      '',
      'export const serverOptions: ProjectServerOptions = { devMode: true, devReload: true };',
      ''
    ].join('\n');
    await write('src/config/serverOptions.ts', source);

    const shown = await runMigrations({ root, lastUpgraded: undefined }, [livePagesOption], { write: false });
    expect(shown).toEqual([expect.objectContaining({ line: 3, writable: true, written: false })]);
    expect(await read('src/config/serverOptions.ts')).toBe(source);

    await runMigrations({ root, lastUpgraded: undefined }, [livePagesOption], { write: true });
    expect(await read('src/config/serverOptions.ts')).toBe(source.replace('devReload', 'livePages'));
  });

  it('leaves a devReload of the project’s own', async () => {
    const own = 'export const devReload = () => location.reload();\n';
    await write('src/space/own.ts', own);

    expect(await runMigrations({ root, lastUpgraded: undefined }, [livePagesOption], { write: true })).toEqual([]);
    expect(await read('src/space/own.ts')).toBe(own);
  });
});
