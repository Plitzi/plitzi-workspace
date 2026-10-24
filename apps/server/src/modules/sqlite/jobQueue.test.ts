import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteJobQueue } from './jobQueue';
import { createSqliteKv } from './kv';
import { openDatabase } from './open';
import { describeJobQueue } from '../actions/jobs/tests/jobQueueContract';

import type { JobInput } from '@plitzi/sdk-shared';

const folders: string[] = [];

const fileIn = (): string => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-sqlite-jobs-'));
  folders.push(folder);

  return path.join(folder, 'state.sqlite');
};

afterEach(() => {
  for (const folder of folders.splice(0)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

describeJobQueue('sqlite', () =>
  Promise.resolve({ queue: createSqliteJobQueue({ file: fileIn() }), clear: () => Promise.resolve() })
);

const later = (id: string, dueAt: number): JobInput => ({
  id,
  spaceId: 1,
  environment: 'main',
  target: { kind: 'action', name: 'show-starts', trigger: 'later' },
  input: {},
  dueAt,
  maxAttempts: 3
});

describe('a SQLite queue', () => {
  it('runs a job that came due while the server was down, once it is back', async () => {
    let now = 1_000_000;
    const file = fileIn();
    await createSqliteJobQueue({ file, clock: () => now }).enqueue(later('later:show', now + 60_000));

    now += 5 * 60_000;
    const claimed = await createSqliteJobQueue({ file, clock: () => now }).claim({
      workerId: 'w',
      leaseMs: 30_000,
      limit: 10
    });
    expect(claimed.map(job => job.id)).toEqual(['later:show']);
  });

  it('is one queue for every process on the file: a job is claimed by one of them', async () => {
    const file = fileIn();
    const one = createSqliteJobQueue({ file });
    const two = createSqliteJobQueue({ file });
    for (const index of [1, 2, 3, 4]) {
      await one.enqueue(later(`later:${String(index)}`, Date.now() - 1));
    }

    const [first, second] = await Promise.all([
      one.claim({ workerId: 'w-one', leaseMs: 30_000, limit: 3 }),
      two.claim({ workerId: 'w-two', leaseMs: 30_000, limit: 3 })
    ]);
    const ids = [...first, ...second].map(job => job.id);
    expect(ids.sort()).toEqual(['later:1', 'later:2', 'later:3', 'later:4']);
  });

  it('shares a database the deployment opened, beside its kv', async () => {
    const db = openDatabase(fileIn());
    const kv = createSqliteKv({ db });
    const queue = createSqliteJobQueue({ db });
    await kv.set('k', 'v');
    expect(await queue.enqueue(later('later:x', Date.now()))).toBe(true);
    expect(await kv.get('k')).toBe('v');
  });

  it('refuses a table name that is none', () => {
    expect(() => createSqliteJobQueue({ file: fileIn(), table: 'jobs; drop' })).toThrow(/is not a table name/);
  });
});
