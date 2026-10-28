import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isExperience } from './experience';
import { writeJson } from '../core/files';
import { tasksDir } from '../core/paths';
import { readUsage } from '../core/usage';
import { harnessUsage } from '../harness';
import { readRunLog } from '../run';

import type { Experience } from './experience';
import type { CommandPath } from '../../commandPath';
import type { TaskPaths } from '../core/paths';
import type { HarnessUsage } from '../harness';
import type { LoadedRun } from '../run';

/**
 * Each round of a task, as it was worked — written when its agent completes it, so a run's report is put together from
 * what each task kept rather than from what the lead remembers: the time it took, its sessions, its checks and what
 * failed in them, what it was refused, every command it ran and why one failed, what it asked `explain` and did not
 * find, what it noticed of Plitzi, what its harness spent (`harnessUsage.ts`) — and, said by the agent, what it was like
 * to work with Plitzi (`experience.ts`: `task complete --ease --hardest --plitzi-<how> --friction --helped`).
 */

export const TASK_REPORT_VERSION = 1;

export interface TaskRoundReport {
  version: typeof TASK_REPORT_VERSION;
  task: string;
  round: number;
  agent: string;
  /** From its take, or its return after a review, to its `complete`. */
  from: string;
  to: string;
  minutes: number;
  sessions: string[];
  checks: {
    run: number;
    failed: number;
    notOwn: number;
    byStep: Record<string, number>;
    /** Each step that failed, with what it last said: why, without running it again. */
    why: { step: string; said: string[] }[];
  };
  refusals: { code: string; said: string }[];
  commands: {
    run: number;
    failed: number;
    /** What they printed, which the agent read. */
    chars: number;
    seconds: number;
    byName: Record<string, { times: number; failed: number; chars: number; seconds: number }>;
  };
  /**
   * Each command that failed: its reason and the lines of its output that say what failed — a page's console errors and
   * failed requests among them. `verdict` when its failing is what it says of the work (a check, a page check).
   */
  errors: { command: string; error?: string; output?: string[]; verdict?: true }[];
  explain: { asked: string[]; missed: string[] };
  /** What it said of Plitzi while it worked (`run notice --plitzi <how>`). */
  notices: string[];
  /** What it was like to work with Plitzi, in its own words: none from a CLI that did not ask. */
  experience?: Experience;
  /** What its harness spent in the round — when it keeps a session this CLI reads. */
  harness?: HarnessUsage;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

/** A command whose failing is what it says of the work — a check that did not pass — not a failure of its own. */
export const isVerdict = ({ name }: Pick<CommandPath, 'name'>): boolean =>
  ['task check', 'task complete', 'page check', 'page play', 'page measure', 'task look'].includes(name);

const reportsDir = (paths: Pick<TaskPaths, 'dir'>): string => path.join(paths.dir, 'reports');

/** Each step that failed in the round's checks, with what it said the last time it failed (`check`'s `why`). */
const whyOf = (checks: readonly Record<string, unknown>[]): { step: string; said: string[] }[] => {
  const last = new Map<string, string[]>();
  for (const check of checks) {
    for (const each of Array.isArray(check.why) ? check.why : []) {
      if (isRecord(each) && typeof each.step === 'string') {
        last.set(each.step, strings(each.said));
      }
    }
  }

  return [...last].map(([step, said]) => ({ step, said }));
};

/** Puts together the round `round` of a task its agent has just completed, and keeps it beside the task. */
export const keepTaskReport = async (
  loaded: LoadedRun,
  paths: Pick<TaskPaths, 'dir'>,
  report: { task: string; round: number; agent: string; to: string; experience?: Experience }
): Promise<TaskRoundReport> => {
  const log = await readRunLog(loaded.paths);
  const { task, agent, to } = report;
  const about = log.filter(entry => entry.task === task);
  const previous = about.findLast(entry => entry.action === 'complete' && text(entry.at) < to);
  // Where the round began: the first thing its agent did on it since it was last sent — its take on the first round.
  const began = about.find(
    entry => entry.by === agent && text(entry.at) > text(previous?.at) && entry.action !== 'complete'
  );
  const from = text(began?.at) || text(about.find(entry => entry.action === 'take')?.at) || to;
  const within = (at: string): boolean => at >= from && at <= to;
  const mine = log.filter(entry => entry.by === agent && within(text(entry.at)));
  const checks = mine.filter(entry => entry.action === 'check' && entry.task === task);
  const byStep: Record<string, number> = {};
  for (const check of checks) {
    for (const step of strings(check.failed)) {
      byStep[step] = (byStep[step] ?? 0) + 1;
    }
  }

  const usage = readUsage(loaded.paths.dir).filter(line => line.by === agent && within(line.at));
  const byName: TaskRoundReport['commands']['byName'] = {};
  for (const line of usage) {
    const { name } = line;
    const kept = byName[name] ?? { times: 0, failed: 0, chars: 0, seconds: 0 };
    kept.times += 1;
    kept.failed += line.code === 0 ? 0 : 1;
    kept.chars += line.chars;
    kept.seconds += Math.round(line.ms / 100) / 10;
    byName[name] = kept;
  }

  const explained = usage.filter(line => line.name === 'explain');
  const sessions = [...new Set(usage.flatMap(line => (line.session ? [line.session] : [])))];
  const processes = [...new Set(usage.flatMap(line => (line.process ? [line.process] : [])))];
  const harness = await harnessUsage({ sessions, processes, root: loaded.paths.root, from, to });
  const kept: TaskRoundReport = {
    version: TASK_REPORT_VERSION,
    task,
    round: report.round,
    agent,
    from,
    to,
    minutes: Math.round((Date.parse(to) - Date.parse(from)) / 6000) / 10,
    sessions,
    checks: {
      run: checks.length,
      failed: checks.filter(entry => entry.ok === false).length,
      notOwn: checks.filter(entry => strings(entry.notOwn).length > 0).length,
      byStep,
      why: whyOf(checks)
    },
    refusals: mine
      .filter(entry => entry.action === 'refused')
      .map(entry => ({ code: text(entry.code), said: text(entry.message).split('\n')[0].slice(0, 300) })),
    commands: {
      run: usage.length,
      failed: usage.filter(line => line.code !== 0).length,
      chars: usage.reduce((sum, line) => sum + line.chars, 0),
      seconds: Math.round(usage.reduce((sum, line) => sum + line.ms, 0) / 1000),
      byName
    },
    errors: usage.flatMap(line =>
      line.code === 0
        ? []
        : [
            {
              command: line.command,
              ...(line.error ? { error: line.error } : {}),
              ...(line.output ? { output: line.output } : {}),
              ...(isVerdict(line) ? { verdict: true as const } : {})
            }
          ]
    ),
    explain: {
      asked: explained.map(line => line.command.replace(/^plitzi explain\s*/, '')),
      missed: explained.filter(line => line.code !== 0).map(line => line.command.replace(/^plitzi explain\s*/, ''))
    },
    notices: mine.filter(entry => entry.action === 'notice' && entry.about === 'plitzi').map(entry => text(entry.text)),
    ...(report.experience ? { experience: report.experience } : {}),
    ...(harness ? { harness } : {})
  };
  await writeJson(path.join(reportsDir(paths), `${String(report.round)}.json`), kept);

  return kept;
};

const isTaskReport = (value: unknown): value is TaskRoundReport =>
  isRecord(value) &&
  value.version === TASK_REPORT_VERSION &&
  typeof value.task === 'string' &&
  typeof value.round === 'number' &&
  typeof value.agent === 'string' &&
  isRecord(value.checks) &&
  isRecord(value.commands) &&
  (value.experience === undefined || isExperience(value.experience));

/** Every round every task of the run kept, by task, then round. */
export const readTaskReports = async (loaded: LoadedRun): Promise<TaskRoundReport[]> => {
  const tasks = await fs.readdir(tasksDir(loaded.paths)).catch((): string[] => []);
  const reports = await Promise.all(
    tasks.map(async task => {
      const dir = reportsDir({ dir: path.join(tasksDir(loaded.paths), task) });
      const files = (await fs.readdir(dir).catch((): string[] => [])).filter(file => file.endsWith('.json'));

      return Promise.all(
        files.map(async file => {
          const read: unknown = await fs
            .readFile(path.join(dir, file), 'utf-8')
            .then(json => JSON.parse(json) as unknown)
            .catch(() => undefined);

          return isTaskReport(read) ? [read] : [];
        })
      );
    })
  );

  return reports.flat(2).sort((a, b) => a.task.localeCompare(b.task) || a.round - b.round);
};
