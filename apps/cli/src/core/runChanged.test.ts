import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runChanged } from './runChanged';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-run-changed-'));
  await fs.mkdir(path.join(dir, 'cache'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('a wait on a run', () => {
  it('ends the moment the run changes, not at its timer', async () => {
    const started = Date.now();
    const waited = runChanged(dir, 10_000);
    await new Promise(resolve => setTimeout(resolve, 50));
    await fs.writeFile(path.join(dir, 'log.jsonl'), '{}\n');
    await waited;

    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('is not woken by what the copies write, and ends at its timer', async () => {
    // The folder's own making is told late on macOS: let it be told before the wait starts.
    await new Promise(resolve => setTimeout(resolve, 300));
    const started = Date.now();
    const waited = runChanged(dir, 400);
    await new Promise(resolve => setTimeout(resolve, 50));
    await fs.writeFile(path.join(dir, 'cache', 'progress.json'), '{}');
    await waited;

    expect(Date.now() - started).toBeGreaterThanOrEqual(390);
  });
});
