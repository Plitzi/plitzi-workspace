import chalk from 'chalk';

import { cell, visible } from './monitorCells';

import type { Attention, RunView } from '../../runs/view';

/**
 * What needs someone, as a table: for whom, what sort of thing, the task it comes from and the agent at it, then what
 * it says — the most pressing first, what is only to know last. A list of sentences each saying its own task and
 * agent somewhere in it read as a wall (velada-polish).
 */

/** How pressing each sort is: a person's step and what stops the run first, what is only to know last. */
const RANK: Partial<Record<Attention['kind'], number>> = {
  person: 0,
  reconciliation: 0,
  version: 0,
  stopping: 1,
  blocked: 2,
  'refused-again': 2,
  'no-signal': 3,
  'agents-needed': 3,
  'changed-in-project': 4,
  overwrite: 4,
  'known-failure': 5,
  'held-up': 5,
  'slow-review': 5,
  'ui-waits': 5,
  'ui-queued': 3,
  spikes: 5,
  request: 7,
  proposal: 6,
  'long-wait': 6,
  'long-task': 6,
  'left-in-tmp': 6
};

/** A message to the lead is a question to answer, or only to know. */
const isQuestion = (item: Attention): boolean => item.kind === 'message' && / asks \(m\d+\)/.test(item.text);

const rankOf = (item: Attention): number =>
  item.who === 'person' ? -1 : item.kind === 'message' ? (isQuestion(item) ? 2 : 8) : (RANK[item.kind] ?? 6);

/** The sort, in a word or two. */
const sortOf = (item: Attention): string =>
  item.kind === 'message' ? (isQuestion(item) ? 'question' : 'to know') : item.kind.replace(/-/g, ' ');

/** What it says, its task's id and the boilerplate around a message left out: the columns say them. */
const saidOf = (item: Attention): string => {
  const own =
    item.task !== undefined && item.text.startsWith(`${item.task} `)
      ? item.text.slice(item.task.length + 1)
      : item.text;

  return own
    .replace(/^says \((m\d+)\), for you to know: /, '($1) ')
    .replace(/^asks \((m\d+)\): /, '($1) ')
    .replace(/^Request on (\S+) from \S+: Changed by task "[^"]+" \([^)]*\)/, '$1')
    .replace(/ — read: plitzi task inbox$/, '');
};

/** The rows of what needs attention, at most `rows` of them, each cut to `width`. */
export const attentionLines = (view: RunView, width: number, rows: number): string[] => {
  const holder = new Map(view.tasks.flatMap(task => (task.agent ? [[task.id, task.agent] as const] : [])));
  const sorted = [...view.attention].sort((a, b) => rankOf(a) - rankOf(b));
  const shown = sorted.slice(0, rows).map(item => ({
    who: item.who === 'person' ? chalk.red('■ you') : chalk.yellow('⚠ lead'),
    sort: chalk.bold(sortOf(item)),
    task: item.task ?? '',
    agent: chalk.dim(item.task === undefined ? '' : (holder.get(item.task) ?? '')),
    said: saidOf(item)
  }));
  const widthOf = (key: 'who' | 'sort' | 'task' | 'agent') => Math.max(0, ...shown.map(each => visible(each[key])));
  const widths = { who: widthOf('who'), sort: widthOf('sort'), task: widthOf('task'), agent: widthOf('agent') };

  return shown.map(each =>
    cell(
      ` ${cell(each.who, widths.who)}  ${cell(each.sort, widths.sort)}  ${cell(each.task, widths.task)}  ${cell(each.agent, widths.agent)}  ${each.said}`,
      width
    )
  );
};
