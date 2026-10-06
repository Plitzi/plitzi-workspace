import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** What `start:dev` preloads, in a process of its own started in the project's root, as the script starts it. */
const ENV = pathToFileURL(path.resolve(import.meta.dirname, 'env.ts')).href;

let root: string;

/** What the process sees of `names` once the preload ran, started in the root with `env` as its environment. */
const seen = (names: readonly string[], env: Record<string, string> = {}): Record<string, string | undefined> =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--import',
        ENV,
        '-e',
        `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(names)}.map(n => [n, process.env[n]]))))`
      ],
      { cwd: root, env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf-8' }
    )
  ) as Record<string, string | undefined>;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'plitzi-env-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('the .env start:dev preloads', () => {
  it('is in process.env before the entry runs, and a variable the environment sets wins', () => {
    writeFileSync(path.join(root, '.env'), '# the key\nPLITZI_SIGNING_SECRET=abc\nPORT=9000\n');

    expect(seen(['PLITZI_SIGNING_SECRET', 'PORT'], { PORT: '7000' })).toEqual({
      PLITZI_SIGNING_SECRET: 'abc',
      PORT: '7000'
    });
  });

  // A deployment, a fresh clone: the environment is all there is, as with `--env-file-if-exists`.
  it('is nothing when there is no .env', () => {
    expect(seen(['PLITZI_SIGNING_SECRET'])).toEqual({});
  });
});
