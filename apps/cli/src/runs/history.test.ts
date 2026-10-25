import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readHistory, rememberPace } from './history';
import { runReportDir } from './reports';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

const projectWith = async (rows: readonly [number, number][]): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'run-history-'));
  roots.push(root);
  const dir = runReportDir(root, 'shop');
  await fs.mkdir(dir, { recursive: true });
  const tasks = rows.map(([minutes, estimateMinutes], index) => ({
    id: `t-${String(index)}`,
    status: 'done',
    minutes,
    estimateMinutes
  }));
  await fs.writeFile(
    path.join(dir, 'report.json'),
    JSON.stringify({ version: 1, report: { at: '2026-10-21T00:00:00.000Z', tasks } })
  );

  return root;
};

describe('readHistory', () => {
  // Thirty tasks took about a third of their estimates, and one whose approval the log lost ran 885 min of 75.
  it('reads the project’s pace as the middle task’s, which one clock left running does not move', async () => {
    const root = await projectWith([
      [10, 30],
      [20, 60],
      [5, 15],
      [9, 30],
      [12, 40],
      [885, 75]
    ]);

    expect(await readHistory(root)).toEqual({
      from: 'project',
      runs: 1,
      tasks: 6,
      ratio: expect.closeTo(0.33, 2) as number
    });
  });

  it('says no pace from fewer than five done tasks', async () => {
    expect(await readHistory(await projectWith([[10, 30]]))).toBeUndefined();
  });

  // A first run: 630 min estimated, 148 taken — a project with no runs of its own reads this machine's.
  it('reads this machine’s pace before a run of the project ended, and the project’s once one did', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'run-history-empty-'));
    roots.push(empty);
    expect(await readHistory(empty)).toBeUndefined();

    await rememberPace([8, 6, 7, 5, 9, 4].map(minutes => ({ status: 'done', minutes, estimateMinutes: 40 })));

    expect(await readHistory(empty)).toEqual({
      from: 'machine',
      runs: 1,
      tasks: 6,
      ratio: expect.closeTo(0.16, 2) as number
    });
    expect(
      (
        await readHistory(
          await projectWith([
            [10, 30],
            [20, 60],
            [5, 15],
            [9, 30],
            [12, 40]
          ])
        )
      )?.from
    ).toBe('project');
  });
});
