import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createFileJobQueue } from './fileQueue';
import { describeJobQueue } from './tests/jobQueueContract';

import type { FileJobQueue } from './fileQueue';
import type { JobInput } from '@plitzi/sdk-shared';

const folders: string[] = [];
const opened: FileJobQueue[] = [];

const fileIn = (): string => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-jobs-'));
  folders.push(folder);

  return path.join(folder, 'state', 'jobs.json');
};

const open = (file: string, clock?: () => number): FileJobQueue => {
  const queue = createFileJobQueue({ file, ...(clock ? { clock } : {}) });
  opened.push(queue);

  return queue;
};

afterEach(async () => {
  await Promise.all(opened.splice(0).map(queue => queue.close()));
  for (const folder of folders.splice(0)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

describeJobQueue('file', () => Promise.resolve({ queue: open(fileIn()), clear: () => Promise.resolve() }));

/** A run set for later — `ctx.later` — due at `dueAt`. */
const later = (dueAt: number): JobInput => ({
  id: 'later:turn',
  spaceId: 1,
  environment: 'main',
  target: { kind: 'action', name: 'turn-ends', trigger: 'later' },
  input: { room: 'ABCD' },
  dueAt,
  maxAttempts: 3
});

// Carlos: "de qué manera se recupera si el servidor se reinicia" — a project server kept its queue in memory, and a
// restart dropped every `ctx.later` waiting: a run's shows would never have started.
describe('a JSON file queue, across a restart', () => {
  it('runs a job that came due while the server was down, once it is back', async () => {
    let now = 1_000_000;
    const file = fileIn();
    const before = open(file, () => now);
    expect(await before.enqueue(later(now + 60_000))).toBe(true);
    await before.close();

    now += 5 * 60_000;
    const after = open(file, () => now);
    const claimed = await after.claim({ workerId: 'w-after', leaseMs: 30_000, limit: 10 });
    expect(claimed.map(job => [job.id, job.target.name])).toEqual([['later:turn', 'turn-ends']]);
  });

  it('keeps one not due yet waiting for its time', async () => {
    let now = 1_000_000;
    const file = fileIn();
    const before = open(file, () => now);
    await before.enqueue(later(now + 60 * 60_000));
    await before.close();

    now += 60_000;
    const after = open(file, () => now);
    expect(await after.claim({ workerId: 'w', leaseMs: 30_000, limit: 10 })).toEqual([]);
    now += 60 * 60_000;
    expect(await after.claim({ workerId: 'w', leaseMs: 30_000, limit: 10 })).toHaveLength(1);
  });

  it('takes again a job a worker held when the server went down, its attempt written lost', async () => {
    let now = 1_000_000;
    const file = fileIn();
    const before = open(file, () => now);
    await before.enqueue(later(now - 1));
    expect(await before.claim({ workerId: 'w-before', leaseMs: 30_000, limit: 10 })).toHaveLength(1);
    await before.close();

    now += 60_000;
    const after = open(file, () => now);
    const [again] = await after.claim({ workerId: 'w-after', leaseMs: 30_000, limit: 10 });
    expect(again.history.map(attempt => [attempt.status, attempt.workerId])).toEqual([['lost', 'w-before']]);
  });

  it('writes nothing when nothing changed — a claim that took nothing', async () => {
    const file = fileIn();
    const queue = open(file);
    await queue.claim({ workerId: 'w', leaseMs: 30_000, limit: 10 });
    await queue.flush();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('refuses a second process on its file, naming the first, and a file that is no queue', () => {
    const file = fileIn();
    open(file);
    expect(() => createFileJobQueue({ file })).toThrow(/is in use by process/);

    const other = fileIn();
    fs.mkdirSync(path.dirname(other), { recursive: true });
    fs.writeFileSync(other, '{"entries":{}}');
    expect(() => createFileJobQueue({ file: other })).toThrow(/is not a queue it wrote \(no `format: 1`\)/);
  });
});
