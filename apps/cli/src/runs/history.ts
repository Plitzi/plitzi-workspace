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
  /** All the minutes the done tasks took, over all their estimates: below 1, they took less. */
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
  let tasks = 0;
  let took = 0;
  let estimated = 0;
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
      tasks += 1;
      took += Number(minutes);
      estimated += Number(estimate);
    }
  }

  return tasks >= MIN_TASKS && estimated > 0 ? { runs, tasks, ratio: took / estimated } : undefined;
};
