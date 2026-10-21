import chalk from 'chalk';

import { hhmm, ID_WIDTH, idCell } from './monitorCells';

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

/** One event of the activity: when, what kind, who — and to whom, for a message — and what, its words quoted. */
export const feedRow = (line: FeedLine, opened = false): string => {
  const look = FEED_LOOK[line.kind];
  const who = line.to === undefined ? line.by : `${line.by} → ${line.to}`;
  const what = line.quote === undefined ? line.text : `${line.kind === 'question' ? 'asks: ' : ''}“${line.quote}”`;

  const again =
    line.count === undefined
      ? ''
      : chalk.bold(` ×${String(line.count)}`) +
        chalk.dim(` since ${hhmm(line.since ?? line.at)} · click ${opened ? 'folds' : 'opens'} it`);
  // Left of the time, what a glance down the column reads first: a group folded, a group open, or a single event.
  const fold = line.count === undefined ? '  ' : chalk.bold(opened ? '▾ ' : '▸ ');

  // The task its own column, empty when the event is about none: what happened to which task reads down the board.
  const task = line.task === undefined ? ' '.repeat(ID_WIDTH) : chalk.cyan(idCell(line.task));

  return `${fold}${chalk.dim(hhmm(line.at))} ${look.mark} ${chalk.bold(who.padEnd(WHO_WIDTH))} ${task} ${look.tone(what)}${again}`;
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
export const repeatRow = (line: FeedLine): string =>
  // The columns of its group's line — fold, time, mark, who, task — its words a little right of the group's WHAT, as
  // what hangs from it.
  chalk.dim(
    `  ${hhmm(line.at)} └ ${' '.repeat(WHO_WIDTH)} ${' '.repeat(ID_WIDTH)}   ${line.quote === undefined ? line.text : `“${line.quote}”`}`
  );

/** The activity's "who" column: an agent, or who to whom for a message. */
export const WHO_WIDTH = 24;
