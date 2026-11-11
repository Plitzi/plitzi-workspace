import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isRunRefusal } from './refusal';
import { LockTimeout, withLock } from './store';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-lock-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/** A process id no process of this machine has: past the highest the system hands out. */
const GONE_PID = 2 ** 22 + 7;

describe('a lock', () => {
  // A look that crashed left its task's lock; the next look waited its whole ten minutes, then crashed too.
  it('is taken over at once when the process of this machine that held it is gone', async () => {
    const file = path.join(dir, 'look.lock');
    await fs.writeFile(file, JSON.stringify({ pid: GONE_PID, machine: os.hostname(), at: new Date().toISOString() }));
    const started = Date.now();
    expect(await withLock(file, () => Promise.resolve('looked'), { waitMs: 5_000 })).toBe('looked');
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('held by a live process past the wait, is refused in words naming what holds it — never thrown raw', async () => {
    const file = path.join(dir, 'look.lock');
    await fs.writeFile(
      file,
      JSON.stringify({ pid: process.pid, machine: os.hostname(), at: new Date().toISOString() })
    );
    const refused = await withLock(file, () => Promise.resolve('never'), {
      waitMs: 100,
      doing: 'a look of t-home'
    }).then(
      () => undefined,
      (error: unknown) => error
    );
    expect(refused).toBeInstanceOf(LockTimeout);
    expect(isRunRefusal(refused)).toBe(true);
    expect(refused instanceof Error ? refused.message : '').toContain('a look of t-home is going on');
    expect(refused instanceof Error ? refused.message : '').not.toContain('merge');
  });

  it("of another machine is never judged gone by this one's processes", async () => {
    const file = path.join(dir, 'merge.lock');
    await fs.writeFile(
      file,
      JSON.stringify({ pid: GONE_PID, machine: 'another-machine', at: new Date().toISOString() })
    );
    await expect(withLock(file, () => Promise.resolve('merged'), { waitMs: 100 })).rejects.toBeInstanceOf(LockTimeout);
  });
});
