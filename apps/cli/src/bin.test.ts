import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bin.ts');
const TSX = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

/** The longest a start may take before it is stopped: a start is under a second, and five on a busy runner. */
const START_MS = 60_000;

/**
 * `plitzi <args>` started in `cwd` as a project's script starts it, and what it printed. One that does not end is
 * stopped and said with what it had printed by then — nothing at all is a start that never got there, the whole help a
 * process that printed and did not leave — where the test's own timeout says only that it waited.
 */
const started = (cwd: string, args: string[], startMs = START_MS): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      ['--import', TSX, BIN, ...args],
      { cwd, env: { ...process.env, PLITZI_TOKEN: '', PLITZI_AGENT: '' }, timeout: startMs, killSignal: 'SIGKILL' },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(stdout);

          return;
        }

        const why = error.killed ? `was stopped after ${String(startMs)} ms` : error.message;
        reject(new Error(`plitzi ${args.join(' ')} ${why}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      }
    );
    // Nothing is typed to it: left open, a command that reads its input would wait on this test.
    child.stdin?.end();
  });

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-bin-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

// A pnpm project read `npm start` and `npx plitzi …` from the CLI it runs.
describe('the CLI started in a project', () => {
  it(
    'says its commands the way the project installs',
    async () => {
      await fs.writeFile(path.join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");

      const stdout = await started(dir, ['--help']);

      expect(stdout).toContain('pnpm start');
      expect(stdout).toContain('pnpm exec plitzi verify');
      expect(stdout).not.toMatch(/(?:^|\s)npm start/m);
    },
    START_MS + 15_000
  );

  it('says what a start that did not end had printed', async () => {
    await expect(started(dir, ['--help'], 1)).rejects.toThrow(/plitzi --help was stopped after 1 ms\nstdout:\n/);
  });
});
