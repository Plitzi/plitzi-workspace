import chalk from 'chalk';

import { hhmm, ID_WIDTH, idCell, wrapped } from './monitorCells';

import type { FeedLine } from '../../runs/monitor';

/** The activity as the monitor draws it: each event's mark, its columns, a group of repeats opened or folded. */

/** Each kind of event, at a glance: its mark and the colour of its words. */
export const FEED_LOOK: Record<FeedLine['kind'], { mark: string; tone: (text: string) => string }> = {
  take: { mark: chalk.cyan('▶'), tone: chalk.cyan },
  complete: { mark: chalk.blue('⇢'), tone: chalk.blue },
  review: { mark: chalk.magenta('◎'), tone: chalk.magenta },
  approved: { mark: chalk.green('✓'), tone: chalk.green },
  'sent-back': { mark: chalk.yellow('↺'), tone: chalk.yellow },
  message: { mark: '✉', tone: text => text },
  question: { mark: chalk.yellow.bold('?'), tone: chalk.yellow },
  agent: { mark: chalk.dim('·'), tone: chalk.dim },
  run: { mark: chalk.bold('◆'), tone: chalk.bold },
  problem: { mark: chalk.red('✗'), tone: chalk.red },
  other: { mark: chalk.dim('·'), tone: chalk.dim }
};

/** How wide the activity's WHO and TASK columns are: what their longest says, narrower on a narrow terminal. */
export interface FeedColumns {
  who: number;
  task: number;
}

const whoOf = (line: FeedLine): string => (line.to === undefined ? line.by : `${line.by} → ${line.to}`);

/**
 * The columns the activity needs at this width: as wide as the longest who and task in it, never wider than a column
 * may be — less on a narrow terminal, where its words need the room — nor narrower than its name.
 */
export const feedColumns = (lines: readonly FeedLine[], width: number): FeedColumns => {
  const narrow = width < 110;
  const longest = (of: (line: FeedLine) => number) => Math.max(0, ...lines.map(of));

  return {
    who: Math.min(
      narrow ? 16 : WHO_WIDTH,
      Math.max(
        4,
        longest(line => whoOf(line).length)
      )
    ),
    task: Math.min(
      narrow ? 14 : ID_WIDTH,
      Math.max(
        4,
        longest(line => line.task?.length ?? 0)
      )
    )
  };
};

/** Whether a line opens under it: a group of repeats, or one whose text says less than its whole. */
export const opens = (line: FeedLine): boolean => line.count !== undefined || line.detail !== undefined;

/**
 * A line's whole, opened under it: its words wrapped to the activity's width, starting under its WHAT — the fold, the
 * time, the mark, who and the task are the columns left of it.
 */
export const detailRows = (line: FeedLine, columns: FeedColumns, width: number): string[] => {
  if (line.detail === undefined) {
    return [];
  }

  const indent = 12 + columns.who + columns.task;

  return wrapped(line.detail.split(' '), Math.max(20, width - indent), ' ').map(each =>
    chalk.dim(`${' '.repeat(indent)}${each}`)
  );
};

/** One event of the activity: when, what kind, who — and to whom, for a message — and what, its words quoted. */
export const feedRow = (line: FeedLine, columns: FeedColumns, opened = false): string => {
  const look = FEED_LOOK[line.kind];
  const who = whoOf(line);
  const what = line.quote === undefined ? line.text : `${line.kind === 'question' ? 'asks: ' : ''}“${line.quote}”`;

  const again =
    line.count === undefined
      ? ''
      : chalk.bold(` ×${String(line.count)}`) +
        chalk.dim(` since ${hhmm(line.since ?? line.at)} · click ${opened ? 'folds' : 'opens'} it`);
  // Left of the time, what a glance down the column reads first: a line that opens — a group, or one with more to say —
  // folded or open, or a single event said whole.
  const fold = !opens(line) ? '  ' : chalk.bold(opened ? '▾ ' : '▸ ');

  // The task its own column, empty when the event is about none: what happened to which task reads down the board.
  const task = line.task === undefined ? ' '.repeat(columns.task) : chalk.cyan(idCell(line.task, columns.task));

  return `${fold}${chalk.dim(hhmm(line.at))} ${look.mark} ${chalk.bold(idCell(who, columns.who))} ${task} ${look.tone(what)}${again}`;
};

export const FEED_WORDS: Record<FeedLine['kind'], string> = {
  take: 'took',
  complete: 'sent to review',
  review: 'review',
  approved: 'approved',
  'sent-back': 'sent back',
  message: 'message',
  question: 'question',
  agent: 'agent',
  run: 'run',
  problem: 'problem',
  other: 'other'
};
/** A group of repeated events, as a person opens it: its newest line's time and words. */
export const groupKey = (line: FeedLine): string => `${line.at}|${line.by}|${line.group ?? line.text}`;

/** One repeat of an opened group, under its line: its time and its own words. */
export const repeatRow = (line: FeedLine, columns: FeedColumns): string =>
  // The columns of its group's line — fold, time, mark, who, task — its words a little right of the group's WHAT, as
  // what hangs from it.
  chalk.dim(
    `  ${hhmm(line.at)} └ ${' '.repeat(columns.who)} ${' '.repeat(columns.task)}   ${line.quote === undefined ? line.text : `“${line.quote}”`}`
  );

/** The widest the activity's "who" column is: an agent, or who to whom for a message. */
export const WHO_WIDTH = 24;
