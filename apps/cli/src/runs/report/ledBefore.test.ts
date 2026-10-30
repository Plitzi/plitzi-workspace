import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ledBefore } from './ledBefore';
import { RUN_REPORTS_DIR } from '../../scaffold/paths';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

/** A project whose reports keep each run's usage, its lead in the session named. */
const projectWith = async (runs: Record<string, string>): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-led-'));
  roots.push(root);
  for (const [run, session] of Object.entries(runs)) {
    const records = path.join(root, RUN_REPORTS_DIR, run, 'records');
    await fs.mkdir(records, { recursive: true });
    await fs.writeFile(
      path.join(records, 'usage.jsonl'),
      `${JSON.stringify({ by: 'dev-1', session: 'other' })}\n${JSON.stringify({ by: 'lead', session })}\n`
    );
  }

  return root;
};

// A run's lead read 33.8M tokens, more than its team: its session had led the two runs before, read again each turn.
describe('the runs a session led before', () => {
  it('names the runs whose lead was this session, and none for a session unknown', async () => {
    const root = await projectWith({ 'backlog-2': 's-1', 'backlog-3': 's-1', hazards: 's-2' });

    expect(await ledBefore(root, 's-1')).toEqual(['backlog-2', 'backlog-3']);
    expect(await ledBefore(root, 's-9')).toEqual([]);
    expect(await ledBefore(root, undefined)).toEqual([]);
  });
});
