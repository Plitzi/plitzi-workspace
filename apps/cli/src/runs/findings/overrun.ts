import { WORK_LIMIT_MINUTES } from '../agents/limits';
import { isApproval } from '../run';

import type { Finding, LogEntry } from './types';
import type { TaskReport } from '../report/report';

/**
 * A task that ran long, with what the run kept of why — read off its log, never left to the lead's memory: a run's
 * report said only "t-visual-specs took 148 min of an estimated 60", and why (its acceptance rewritten twice, an
 * escalation, a round crossed with the lead's word, three spikes opened beside it, nobody cutting it) was put together by
 * hand before the person could decide on applying it.
 */

/** Past twice its estimate, or past three pieces of work: something was wrong, and the report says what it kept of it. */
const ranLong = (task: TaskReport): task is TaskReport & { minutes: number } =>
  task.minutes !== undefined && (task.minutes > task.estimateMinutes * 2 || task.minutes > WORK_LIMIT_MINUTES * 3);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const clock = (at: unknown): string => text(at).slice(11, 16);
const clip = (value: string, most = 140): string => (value.length > most ? `${value.slice(0, most - 1)}…` : value);

/** The log's entries of the task's own life, from its first take to its approval. */
const lifeOf = (log: readonly LogEntry[], task: string): LogEntry[] => {
  const taken = log.findIndex(entry => entry.action === 'take' && entry.task === task);
  const approved = log.findIndex((entry, index) => index > taken && entry.task === task && isApproval(entry));

  return taken === -1 ? [] : log.slice(taken, approved === -1 ? undefined : approved + 1);
};

const amends = (entry: LogEntry, task: string): boolean =>
  entry.action === 'amend' &&
  Array.isArray(entry.tasks) &&
  entry.tasks.some(each => typeof each === 'object' && each !== null && Reflect.get(each, 'task') === task);

export const overrunFindings = (tasks: readonly TaskReport[], log: readonly LogEntry[]): Finding[] =>
  tasks.filter(ranLong).map(task => {
    const life = lifeOf(log, task.id);
    const amended = log.filter(entry => amends(entry, task.id));
    const escalated = life.filter(entry => entry.action === 'review-escalated' && entry.task === task.id);
    const sentBack = life.filter(
      entry => entry.action === 'review' && entry.task === task.id && entry.verdict === 'changes'
    );
    const stacked = life
      .filter(entry => entry.action === 'extend' && Array.isArray(entry.added))
      .flatMap(entry => (Array.isArray(entry.added) ? entry.added.map(text) : []));
    const cut = life.some(entry => (entry.action === 'reassign' || entry.action === 'cut') && entry.task === task.id);
    const limits = Math.floor(task.minutes / WORK_LIMIT_MINUTES);

    return {
      kind: 'over-estimate' as const,
      owner: 'lead' as const,
      title: `${task.id} took ${String(task.minutes)} min of an estimated ${String(task.estimateMinutes)} — past the ${String(WORK_LIMIT_MINUTES)}-minute piece of work ${String(limits)} times`,
      evidence: [
        ...(amended.length > 0
          ? [
              `its acceptance rewritten ${String(amended.length)}× (${amended.map(entry => clock(entry.at)).join(', ')} UTC)`
            ]
          : []),
        ...escalated.map(entry => `escalated at ${clock(entry.at)} UTC: ${clip(text(entry.why))}`),
        ...(sentBack.length > 0
          ? [
              `sent back ${String(sentBack.length)}×: ${task.reviews
                .map(review => `round ${String(review.round)}, ${review.by}: ${clip(review.asked, 100)}`)
                .join(' · ')}`
            ]
          : []),
        ...(stacked.length > 0 ? [`stacked beside it while it ran: ${stacked.join(', ')}`] : []),
        ...(task.files.length > 6 ? [`${String(task.files.length)} files: a scope wider than one piece of work`] : []),
        ...(task.knownFailure ? [`approved over a known failure: ${clip(task.knownFailure)}`] : []),
        ...(cut ? [] : ['never split, narrowed nor reassigned while it ran'])
      ],
      times: 1,
      fix: `at each ${String(WORK_LIMIT_MINUTES)} minutes the lead asks where it stands (task message @<agent> --standing) and decides: on, narrowed, the rest a task of its own (run extend), or reassigned — a bug found inside it is another task`,
      subject: `over-estimate:${task.id}`,
      task: task.id
    };
  });

/** How long the lead may take from the last approval to the finish's dry run passing before it is a finding. */
const CLOSE_MINUTES = 15;

/** Every task approved and the run left open: the team waits on the lead's close (one sat past its approval). */
export const closeFindings = (log: readonly LogEntry[], now: string): Finding[] => {
  const approved = log.findLast(entry => entry.action === 'all-approved');
  if (!approved) {
    return [];
  }

  // Not ready yet, it is measured to now: the report is written before the finish's dry run — a close on its way.
  const ready = log.find(entry => entry.action === 'ready' && text(entry.at) >= text(approved.at));
  const minutes = (Date.parse(ready ? text(ready.at) : now) - Date.parse(text(approved.at))) / 60_000;
  if (minutes <= CLOSE_MINUTES) {
    return [];
  }

  return [
    {
      kind: 'slow-close',
      owner: 'lead',
      title:
        ready === undefined
          ? `Every task was approved at ${clock(approved.at)} UTC, and ${String(Math.round(minutes))} min later the finish's dry run had not passed`
          : `Every task was approved at ${clock(approved.at)} UTC; the run was ready to apply ${String(Math.round(minutes))} min later`,
      evidence: ['the base agents waited for the close meanwhile, each wait a turn of theirs'],
      times: 1,
      fix: 'close at the wake run watch gives: run look, run report --summary, run finish',
      subject: 'slow-close'
    }
  ];
};
