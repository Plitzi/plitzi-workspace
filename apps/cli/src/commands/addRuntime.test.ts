import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import addRuntime from './addRuntime';
import create from './create';

/**
 * `plitzi add runtime`: the space's runtime written where the project's server runs it and `plitzi runtime push` finds
 * it — the same module tried here before it goes — and `start:dev` restarting on it.
 */

let dir = '';
let said: string[] = [];

const read = (file: string): Promise<string> => fs.readFile(path.join(dir, file), 'utf-8');

const startDev = async (): Promise<unknown> => JSON.parse(await read('package.json')) as unknown;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-runtime-'));
  said = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => said.push(String(line)));
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => said.push(String(line)));
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fs.rm(dir, { recursive: true, force: true });
});

const project = async (mode: 'server' | 'client'): Promise<void> => {
  await create(path.join(dir, 'site'), { mode, source: 'local', packageManager: 'npm', install: false });
  dir = path.join(dir, 'site');
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
};

describe('plitzi add runtime', () => {
  it('writes the runtime where the server runs it, and has start:dev restart on it', async () => {
    await project('server');

    await addRuntime({});

    expect(process.exitCode).toBeUndefined();
    expect(await read('src/runtime/index.ts')).toContain('export default defineRuntime({');
    expect(await startDev()).toHaveProperty(
      ['scripts', 'start:dev'],
      expect.stringContaining('--watch-path=./src/runtime')
    );
    // The server already runs whatever is there: nothing of the CLI's changes.
    expect(await read('src/main.ts')).toContain('await loadRuntimeModule(');
  });

  it('leaves a start:dev the project made its own, and says what to add to it', async () => {
    await project('server');
    const manifest: unknown = JSON.parse(await read('package.json'));
    await fs.writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ ...(isRecord(manifest) ? manifest : {}), scripts: { 'start:dev': 'node --watch src/main.ts' } })
    );

    await addRuntime({});

    expect(await startDev()).toHaveProperty(['scripts', 'start:dev'], 'node --watch src/main.ts');
    expect(said.join('\n')).toContain('add --watch-path=./src/runtime');
  });

  it('says with --dry-run what it would write, and writes nothing', async () => {
    await project('server');

    await addRuntime({ dryRun: true });

    expect(said.join('\n')).toContain('+ src/runtime/index.ts');
    await expect(read('src/runtime/index.ts')).rejects.toThrow();
  });

  it('refuses a project with no server, where a runtime would run nowhere', async () => {
    await project('client');

    await addRuntime({});

    expect(process.exitCode).toBe(1);
    expect(said.join('\n')).toContain('A runtime runs beside a server');
  });
});
