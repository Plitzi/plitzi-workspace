import chalk from 'chalk';

import { cell, wrapped } from './monitorCells';

import type { TaskLine } from '../../runs/view';

/** The narrowest a stage is drawn: its name and a count of two digits whole (`◎ lead review (12)`). */
const MIN_STAGE = 19;
/** The widest: past it a stage's cards are no easier to read, and the row is only longer. */
const MAX_STAGE = 30;
/** What goes between two stages: an arrow to the next step, or a bar before one that is no step after it. */
const GAP = 4;
/** What starts each band: the arrow a band carried on from the one above starts with, the first's a blank as wide. */
const LEAD = 2;

interface Stage {
  name: string;
  tone: (text: string) => string;
  tasks: TaskLine[];
  who?: (task: TaskLine) => string;
  /** Not a step after the one before it: drawn past a bar, not an arrow. */
  apart?: boolean;
}

/** Where every task stands, stage by stage: from to-do to approved, what holds an agent back, and what is sent back. */
const stagesOf = (tasks: readonly TaskLine[]): Stage[] => {
  const of = (status: TaskLine['status']) => tasks.filter(task => task.status === status);

  return [
    { name: '· pending', tone: chalk.dim, tasks: of('pending') },
    { name: '○ ready', tone: text => text, tasks: of('ready') },
    {
      name: '▶ at work',
      tone: chalk.cyan,
      tasks: of('in-progress').filter(task => !task.asking),
      who: task => task.agent ?? ''
    },
    // What holds an agent back: a block, a file another task has, a question to the lead, a failure.
    {
      name: '■ held',
      tone: chalk.yellow,
      tasks: [...of('blocked'), ...of('waiting'), ...tasks.filter(task => task.asking), ...of('failed')],
      who: task =>
        task.asking
          ? `asks lead (${task.asking.id})`
          : task.status === 'blocked'
            ? `blocked: needs ${task.blockedBy?.needs ?? 'someone'}`
            : task.status === 'waiting'
              ? `waits ${task.waitingFor?.task ?? 'a file'}`
              : 'failed'
    },
    {
      name: '◎ UI review',
      tone: chalk.magenta,
      tasks: of('in-review').filter(task => task.design?.status === 'due'),
      who: task => task.design?.by ?? 'nobody yet'
    },
    {
      name: '◎ lead review',
      tone: chalk.magenta,
      tasks: of('in-review').filter(task => task.design?.status !== 'due'),
      who: task => task.reviewer ?? 'no lead yet'
    },
    { name: '✓ approved', tone: chalk.green, tasks: of('done') },
    // Sent back by a review: no step toward approved, but back to the work of the same agent — set apart.
    {
      name: '↺ sent back',
      tone: chalk.yellow,
      tasks: of('changes-requested').filter(task => !task.asking),
      who: task => `${task.agent ?? ''} r${String(task.round)}`,
      apart: true
    }
  ];
};

/** How many stages a band of the flow holds at this width: all of them on a wide screen, fewer to a row on a narrow one. */
const stagesPerBand = (width: number, stages: number): number =>
  Math.min(stages, Math.max(1, Math.floor((width + GAP) / (MIN_STAGE + GAP))));

/**
 * The run as a flow, from to-do to approved — the board's kanban: each stage with how many tasks stand in it and which,
 * what holds an agent back, the review split in its UI's and the lead's, and what is sent back. Drawn to the width: the
 * stages in one band on a wide screen, in bands one under the other on a narrow one; `depth` cards a stage at most, the
 * rest counted.
 */
export const flowLines = (
  tasks: readonly TaskLine[],
  width: number,
  { depth = 8, note = true }: { depth?: number; note?: boolean } = {}
): string[] => {
  const stages = stagesOf(tasks);
  const perBand = stagesPerBand(width - LEAD, stages.length);
  const stageWidth = Math.min(MAX_STAGE, Math.floor((width - LEAD - GAP * (perBand - 1)) / perBand));
  const fit = (text: string) => cell(text, stageWidth);
  const arrow = chalk.dim(' ─▶ ');
  const bar = chalk.dim('  │ ');
  const bands = Array.from({ length: Math.ceil(stages.length / perBand) }, (_, index) =>
    stages.slice(index * perBand, (index + 1) * perBand)
  );

  const bandLines = (band: Stage[], index: number): string[] => {
    // Each stage after the first, past an arrow — or a bar, for one that is no step after the one before it. A band
    // that goes on from the one above starts with an arrow of its own: the flow reads on.
    const joined = (cells: string[], edge: (stage: Stage) => string) =>
      cells.map((each, at) => (at === 0 ? each : `${edge(band[at])}${each}`)).join('');
    const lead = index === 0 ? ' '.repeat(LEAD) : chalk.dim('▶ ');
    const head = joined(
      band.map(stage => fit(stage.tone(chalk.bold(`${stage.name} (${String(stage.tasks.length)})`)))),
      stage => (stage.apart ? bar : arrow)
    );
    const deepest = Math.min(depth, Math.max(0, ...band.map(stage => stage.tasks.length)));
    const rows = Array.from({ length: deepest }, (_, row) =>
      joined(
        band.map(stage => {
          const task = stage.tasks.at(row);

          return task ? fit(`${stage.tone(task.id)}${stage.who ? chalk.dim(` ${stage.who(task)}`) : ''}`) : fit('');
        }),
        stage => (stage.apart ? bar : '    ')
      )
    );
    const more = band.some(stage => stage.tasks.length > deepest)
      ? [
          chalk.dim(
            joined(
              band.map(stage =>
                fit(stage.tasks.length > deepest ? `+ ${String(stage.tasks.length - deepest)} more` : '')
              ),
              stage => (stage.apart ? bar : '    ')
            )
          )
        ]
      : [];

    return [`${lead}${head}`, ...[...rows, ...more].map(row => `${' '.repeat(LEAD)}${row}`)].map(line =>
      cell(line, width)
    );
  };

  return [
    cell(chalk.bold('FLOW') + chalk.dim('  each task left to right, from to-do to approved · f hides it'), width),
    ...bands.flatMap(bandLines),
    ...(note
      ? [
          cell(
            chalk.dim(
              '  ↺ sent back: to the same agent, who redoes it on the approved — another takes it if it goes silent'
            ),
            width
          )
        ]
      : [])
  ];
};

/**
 * The flow in a line or two, for a terminal too short for its cards: each stage and how many tasks stand in it — the
 * kanban's picture, if not its cards.
 */
const countsOnly = (tasks: readonly TaskLine[], width: number): string[] =>
  wrapped(
    stagesOf(tasks).map(
      (stage, index) =>
        `${index === 0 ? `${chalk.bold('FLOW')}  ` : ''}${stage.tone(`${stage.name} (${String(stage.tasks.length)})`)}`
    ),
    width,
    chalk.dim(' ─▶ ')
  );

/**
 * The flow as deep as `rows` lets it be: its stages' cards cut to fewer a stage, then its note left out — and, where not
 * even a card a stage fits, each stage's count in a line or two: the kanban is what the board is for, never left out.
 */
export const fittedFlow = (tasks: readonly TaskLine[], width: number, rows: number, note: boolean): string[] => {
  for (const withNote of note ? [true, false] : [false]) {
    for (let depth = 8; depth >= 1; depth -= 1) {
      const lines = flowLines(tasks, width, { depth, note: withNote });
      if (lines.length <= rows) {
        return lines;
      }
    }
  }

  return countsOnly(tasks, width);
};
