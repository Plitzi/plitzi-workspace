import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readRunReports } from './reports';
import { configDir } from '../account/connection';

/**
 * How this project's runs went against their estimates, read off the reports they left (`reports.ts`): each
 * done task's minutes over its estimate. What `run plan` and `run rehearse` scale a new plan's estimates by — a lead's
 * guess at minutes is the same guess every time, and the project's own runs say by how much it is off.
 */

export interface History {
  /**
   * Whose runs it is read from: the project's own, or — before a run of it ended — this machine's, any project's: a
   * lead's guess is off the same way from one project to the next (a first run: 630 min estimated, 148 taken).
   */
  from: 'project' | 'machine';
  runs: number;
  tasks: number;
  /**
   * The middle of each done task's minutes over its estimate: below 1, they took less. The middle, not the sum: one task
   * whose clock ran on (a run's t-tier-list, 885 min of 75, its approval lost) outweighed thirty that took a third.
   */
  ratio: number;
}

/** Below this many done tasks, a ratio says more about the few than about the project: none is given. */
const MIN_TASKS = 5;

/** The newest reports read, at most: an old run's pace is another project's, more often than not. */
const MAX_REPORTS = 10;

/** A done task's minutes over its estimate, as its report kept it: none for a task not done, or with no estimate. */
const ratioOf = (task: unknown): number[] =>
  isRecord(task) &&
  task.status === 'done' &&
  typeof task.minutes === 'number' &&
  typeof task.estimateMinutes === 'number' &&
  task.estimateMinutes > 0
    ? [task.minutes / task.estimateMinutes]
    : [];

export const readHistory = async (root: string): Promise<History | undefined> => {
  let runs = 0;
  const ratios: number[] = [];
  for (const { data } of (await readRunReports(root)).slice(-MAX_REPORTS)) {
    const tasks: unknown[] = isRecord(data.report) && Array.isArray(data.report.tasks) ? data.report.tasks : [];
    const done = tasks.flatMap(ratioOf);
    if (done.length > 0) {
      runs += 1;
    }

    ratios.push(...done);
  }

  if (ratios.length < MIN_TASKS) {
    const machine = await readMachinePace();

    return machine.ratios.length < MIN_TASKS
      ? undefined
      : { from: 'machine', runs: machine.runs, tasks: machine.ratios.length, ratio: middleOf(machine.ratios) };
  }

  return { from: 'project', runs, tasks: ratios.length, ratio: middleOf(ratios) };
};

const middleOf = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/** This machine's pace: each done task's minutes over its estimate, of every project's runs that ended here. */
interface MachinePace {
  runs: number;
  ratios: number[];
}

/** The most kept: the newest, a few runs' worth — how the agents on this machine work now. */
const MAX_MACHINE_RATIOS = 300;

const paceFile = (): string => path.join(configDir(), 'pace.json');

const readMachinePace = async (): Promise<MachinePace> => {
  const read: unknown = await fs
    .readFile(paceFile(), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isRecord(read) &&
    typeof read.runs === 'number' &&
    Array.isArray(read.ratios) &&
    read.ratios.every(value => typeof value === 'number' && Number.isFinite(value))
    ? { runs: read.runs, ratios: read.ratios as number[] }
    : { runs: 0, ratios: [] };
};

/**
 * A run that ended, kept in this machine's pace: each done task's minutes over its estimate. A pace that cannot be
 * written costs the next first run its estimate's correction, never the run's end: said, and let go.
 */
export const rememberPace = async (tasks: readonly { minutes?: number; estimateMinutes: number; status: string }[]) => {
  const ratios = tasks.flatMap(task =>
    task.status === 'done' && task.minutes !== undefined && task.estimateMinutes > 0
      ? [task.minutes / task.estimateMinutes]
      : []
  );
  if (ratios.length === 0) {
    return;
  }

  const before = await readMachinePace();
  const pace: MachinePace = {
    runs: before.runs + 1,
    ratios: [...before.ratios, ...ratios].slice(-MAX_MACHINE_RATIOS)
  };
  await fs
    .mkdir(configDir(), { recursive: true })
    .then(() => fs.writeFile(paceFile(), `${JSON.stringify(pace)}\n`))
    .catch((error: unknown) => {
      console.warn(
        `This machine's pace was not kept (${paceFile()}): ${error instanceof Error ? error.message : String(error)}`
      );
    });
};
