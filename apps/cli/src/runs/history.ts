import fs from 'node:fs/promises';
import path from 'node:path';

import { REPORTS_DIR } from './paths';

/**
 * How this project's runs went against their estimates, read off the reports they left (`tmp/plitzi-reports/`): each
 * done task's minutes over its estimate. What `run plan` and `run rehearse` scale a new plan's estimates by — a lead's
 * guess at minutes is the same guess every time, and the project's own runs say by how much it is off.
 */

export interface History {
  runs: number;
  tasks: number;
  /**
   * The middle of each done task's minutes over its estimate: below 1, they took less. The middle, not the sum: one task
   * whose clock ran on (la-velada's t-tier-list, 885 min of 75, its approval lost) outweighed thirty that took a third.
   */
  ratio: number;
}

/** Below this many done tasks, a ratio says more about the few than about the project: none is given. */
const MIN_TASKS = 5;

/** The newest reports read, at most: an old run's pace is another project's, more often than not. */
const MAX_REPORTS = 10;

/** A row of a report's tasks table: `| t-home | developer | done | dev-1 | 9 / 30 | …` — its minutes and estimate. */
const ROW = /^\| [^|]+ \| [^|]+ \| done \| [^|]+ \| (\d+) \/ (\d+) \|/;

export const readHistory = async (root: string): Promise<History | undefined> => {
  const dir = path.join(root, REPORTS_DIR);
  const names = (await fs.readdir(dir).catch(() => []))
    .filter(name => name.endsWith('.md'))
    .sort()
    .slice(-MAX_REPORTS);
  let runs = 0;
  const ratios: number[] = [];
  for (const name of names) {
    const text = await fs.readFile(path.join(dir, name), 'utf-8').catch(() => '');
    const rows = text
      .split('\n')
      .map(line => ROW.exec(line))
      .filter(match => match !== null);
    if (rows.length > 0) {
      runs += 1;
    }

    for (const [, minutes, estimate] of rows) {
      if (Number(estimate) > 0) {
        ratios.push(Number(minutes) / Number(estimate));
      }
    }
  }

  if (ratios.length < MIN_TASKS) {
    return undefined;
  }

  const sorted = ratios.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const ratio = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];

  return { runs, tasks: sorted.length, ratio };
};
