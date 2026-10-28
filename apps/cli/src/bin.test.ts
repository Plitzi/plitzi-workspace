import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bin.ts');
const TSX = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-bin-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

// A pnpm project read `npm start` and `npx plitzi …` from the CLI it runs.
describe('the CLI started in a project', () => {
  it('says its commands the way the project installs', async () => {
    await fs.writeFile(path.join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");

    const { stdout } = await promisify(execFile)(process.execPath, ['--import', TSX, BIN, '--help'], {
      cwd: dir,
      env: { ...process.env, PLITZI_TOKEN: '', PLITZI_AGENT: '' }
    });

    expect(stdout).toContain('pnpm start');
    expect(stdout).toContain('pnpm exec plitzi verify');
    expect(stdout).not.toMatch(/(?:^|\s)npm start/m);
  }, 60_000);
});
