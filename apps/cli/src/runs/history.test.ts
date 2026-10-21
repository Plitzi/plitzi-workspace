import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readHistory } from './history';
import { REPORTS_DIR } from './paths';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

const projectWith = async (rows: readonly [number, number][]): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'run-history-'));
  roots.push(root);
  await fs.mkdir(path.join(root, REPORTS_DIR), { recursive: true });
  await fs.writeFile(
    path.join(root, REPORTS_DIR, 'velada-20261021T000000Z.md'),
    [
      '| Task | Role | Status | Agents | Time / estimate (min) | Reviews |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows.map(
        ([took, estimate], index) =>
          `| t-${String(index)} | developer | done | dev-1 | ${String(took)} / ${String(estimate)} | 1 |`
      )
    ].join('\n')
  );

  return root;
};

describe('readHistory', () => {
  // la-velada: thirty tasks took about a third of their estimates, and one whose approval the log lost ran 885 min of 75.
  it('reads the project’s pace as the middle task’s, which one clock left running does not move', async () => {
    const root = await projectWith([
      [10, 30],
      [20, 60],
      [5, 15],
      [9, 30],
      [12, 40],
      [885, 75]
    ]);

    expect(await readHistory(root)).toEqual({ runs: 1, tasks: 6, ratio: expect.closeTo(0.33, 2) as number });
  });

  it('says no pace from fewer than five done tasks', async () => {
    expect(await readHistory(await projectWith([[10, 30]]))).toBeUndefined();
  });
});
