import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { MAX_LINES } from '../../lint/rules/fileTooLong';

import type { CheckStep } from '../../runs/checks';
import type { Message } from '../../runs/messages';
import type { PlanEstimate } from '../../runs/plan';
import type { RemovedInputs } from '../../runs/run';
import type { TaskShown } from '../../runs/show';
import type { TaskContext } from '../../runs/tasks';

/**
 * The lines the commands say things in, shared.
 */

/** The checks a refusal names as failing, as the CLI wrote them into its detail. */
export const failedSteps = (steps: unknown): CheckStep[] =>
  Array.isArray(steps)
    ? steps.filter((step): step is CheckStep => isRecord(step) && typeof step.name === 'string')
    : [];

/** How close to the line a file of the task already is, when what it adds would likely cross it. */
const NEAR_LINE = 0.85;

export const nearLimit = (context: TaskContext): { file: string; lines: number }[] =>
  context.files.flatMap(each => {
    const lines = each.text?.split('\n').filter(line => line.trim() !== '').length ?? 0;

    return lines >= MAX_LINES * NEAR_LINE ? [{ file: each.file, lines }] : [];
  });

/** A file it changed outside its own — a layout, the theme, the entry — changes every page that reads it: said so. */
export const outsideLines = (shown: TaskShown): string[] => {
  // One it made is its own: only what was there before reaches what other pages read.
  const outside = shown.files
    .filter(each => !shown.task.files.includes(each.file) && each.change !== 'added')
    .map(each => each.file);

  return outside.length > 0
    ? [
        chalk.yellow(
          `  ⚠ Outside its own files: ${outside.join(', ')} — look at every page that reads them, not only this task's`
        )
      ]
    : [];
};

/** What the lead said to a task, as the task's answer shows it: on top, so it is not missed. */
export const messageLines = (messages: readonly Message[]): string[] =>
  messages.map(message => chalk.cyan(`  ✉ ${message.from} (${message.id}): ${message.text}`));

/** Every message of a task's, which way it went: what it was told (←) and what it said (→), each with whom. */
export const exchangeLines = (messages: readonly Message[], taskId: string | undefined): string[] =>
  messages.map(message =>
    taskId !== undefined && message.from === taskId
      ? chalk.dim(`  → ${message.to} (${message.id}): ${message.text}`)
      : chalk.cyan(`  ← ${message.from} (${message.id}): ${message.text}`)
  );

/** What the run removed with it that the lead had handed it — and what it kept, changed since. */
export const inputLines = (inputs: RemovedInputs | undefined): string[] => [
  ...(inputs && inputs.removed.length > 0
    ? [`Removed with the run, as you handed them: ${inputs.removed.join(', ')}`]
    : []),
  ...(inputs && inputs.kept.length > 0 ? [`Kept — changed since the run read them: ${inputs.kept.join(', ')}`] : []),
  ...(inputs && inputs.servers.length > 0
    ? [`Stopped, left listening in its copies: ${inputs.servers.join(', ')}`]
    : [])
];

/** A time as the run says one: hours and minutes, in UTC. */
export const hhmm = (iso: string): string => `${iso.slice(11, 16)} UTC`;

export const list = (items: readonly string[]): string => (items.length > 0 ? items.join(', ') : 'none');

/** The estimate at this project's pace, said with what it is read from. */
export const pacedText = (paced: NonNullable<PlanEstimate['paced']>): string =>
  `At this project's pace — its last ${String(paced.runs)} runs' ${String(paced.tasks)} tasks took ${String(Math.round(paced.ratio * 100))}% of their estimates: about ${String(paced.wallMinutes)} min`;

/** An acceptance line that passed only when run again, said beside its ✓ with what failed the first time; or nothing. */
export const secondRunText = (result: { firstFailed?: readonly string[] }): string =>
  result.firstFailed
    ? chalk.yellow(
        ` — passed on its second run; the first failed${result.firstFailed.length > 0 ? `: ${result.firstFailed.at(-1) ?? ''}` : ''}`
      )
    : '';
