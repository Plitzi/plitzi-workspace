import chalk from 'chalk';

import { cell, idCell, urgencyMark, wrapped } from './monitorCells';

import type { TaskLine } from '../../runs/view';

/** The narrowest a stage is drawn: its name and a count of two digits whole (`◎ lead review (12)`). */
const MIN_STAGE = 19;
/** The widest: past it a stage's cards are no easier to read, and the row is only longer. */
const MAX_STAGE = 30;

/** The least of a card's id kept beside who it is with: enough of its two ends to tell it apart. */
const MIN_ID = 8;
/** What goes between two stages: an arrow to the next step. */
const GAP = 4;
/** What starts each band: the arrow a band carried on from the one above starts with, the first's a blank as wide. */
const LEAD = 2;

interface Stage {
  name: string;
  tone: (text: string) => string;
  tasks: TaskLine[];
  who?: (task: TaskLine) => string;
}

/**
 * A task as its card names it: a task sent back by a review is at work again with the agent that wrote it, marked by
 * the round it is at — `t-boxer ↺2` — rather than in a stage of its own: it goes round the same steps again.
 */
const nameOf = (task: TaskLine): string =>
  task.status === 'changes-requested' ? `${task.id} ↺${String(task.round)}` : task.id;

/** Its urgency, toned and apart from its name — `‼` red, `!` yellow — so it never reads as part of the id. */
const markOf = (task: TaskLine): { text: string; width: number } => {
  const mark = urgencyMark(task).trim();
  if (!mark) {
    return { text: '', width: 0 };
  }

  return { text: `${task.urgency === 'critical' ? chalk.red(mark) : chalk.yellow(mark)} `, width: mark.length + 1 };
};

/**
 * Who a card is with: its agent, the lead at its spike, the designer or lead at its review — what puts it at the top
 * of its stage, the ones nobody is on below (a stage's cards under its scroll were the ones being worked).
 */
const withSomeone = (task: TaskLine): boolean =>
  task.agent !== undefined ||
  task.spikedBy !== undefined ||
  task.reviewer !== undefined ||
  task.design?.by !== undefined;

/** Where a task another waits for stands, in a word or two: what the one waiting for it waits on. */
const standingOf = (task: TaskLine): string =>
  task.status === 'in-review'
    ? task.design?.status === 'due'
      ? 'UI review'
      : 'lead review'
    : task.status === 'in-progress'
      ? 'at work'
      : task.status === 'changes-requested'
        ? 'sent back'
        : task.status;

/**
 * What a pending task waits for: each task it follows that is not approved yet, and where that one stands — "after
 * t-boxer (UI review), t-lint (lead review)". Its tasks at review were a pending task's whole reason, and nothing on
 * the screen said so (t-motion pending while the three it followed waited for one designer).
 */
export const waitsText = (task: TaskLine, tasks: readonly TaskLine[]): string => {
  const left = waitedFor(task, tasks).map(other => `${other.id} (${standingOf(other)})`);

  return left.length > 0 ? `after ${left.join(', ')}` : '';
};

/** The tasks `task` follows that are not approved yet. */
const waitedFor = (task: TaskLine, tasks: readonly TaskLine[]): TaskLine[] => {
  const byId = new Map(tasks.map(each => [each.id, each] as const));

  return (task.waitsOn ?? []).flatMap(id => {
    const other = byId.get(id);

    return other && other.status !== 'done' ? [other] : [];
  });
};

/** Where every task stands, stage by stage: from to-do to approved, and what holds an agent back. */
const stagesOf = (tasks: readonly TaskLine[]): Stage[] => {
  const of = (status: TaskLine['status']) =>
    tasks.filter(task => task.status === status).sort((a, b) => Number(withSomeone(b)) - Number(withSomeone(a)));

  return [
    // In the flow's narrow column, only whom it waits for: where each of them stands is the column it is in.
    {
      name: '· pending',
      tone: chalk.dim,
      tasks: of('pending'),
      who: task => {
        const left = waitedFor(task, tasks).map(other => other.id);

        return left.length > 0 ? `← ${left.join(', ')}` : '';
      }
    },
    // Finding something out before it is built: whoever is on it, or free to take — research waits for nothing. A run
    // that researched nothing has no column for it.
    ...(tasks.some(task => task.status === 'spike' || task.found !== undefined)
      ? [
          {
            name: '◇ spike',
            tone: chalk.blue,
            tasks: of('spike'),
            // Never "free": no agent takes a spike — the lead at it, or one is waited for.
            who: (task: TaskLine) => task.spikedBy ?? 'for a lead'
          }
        ]
      : []),
    // Free to take: no agent's yet — a task sent back is its writer's, at work or held.
    { name: '○ ready', tone: text => text, tasks: of('ready') },
    // One card an agent: the task it is at — written, or again after a review sent it back (↺). The others it holds
    // wait for it, held (dev-2 "ready" with t-home and "at work" with t-overlay at once).
    {
      name: '▶ at work',
      tone: chalk.cyan,
      tasks: [...of('in-progress'), ...of('changes-requested')].filter(task => !task.asking && !task.parkedFor),
      who: task => task.agent ?? ''
    },
    // What holds an agent back: a block, a file another task has, a question to the lead, its agent at another task,
    // a failure.
    {
      name: '■ held',
      tone: chalk.yellow,
      tasks: [
        ...of('blocked'),
        ...of('waiting'),
        ...tasks.filter(task => task.asking),
        ...tasks.filter(task => task.parkedFor),
        ...of('failed')
      ],
      who: task =>
        task.asking
          ? task.asking.answered
            ? `answered (${task.asking.id})`
            : `asks lead (${task.asking.id})`
          : task.parkedFor
            ? `${task.agent ?? ''} at ${task.parkedFor}`
            : task.status === 'blocked'
              ? `blocked: needs ${task.blockedBy?.needs ?? 'someone'}`
              : task.status === 'waiting'
                ? `waits ${task.waitingFor?.task ?? 'a file'}`
                : 'failed'
    },
    {
      name: '◎ UI review',
      tone: chalk.magenta,
      tasks: of('in-review').filter(task => task.design?.status === 'due' && task.reviewer === undefined),
      who: task => task.design?.by ?? 'waiting'
    },
    {
      // A lead that took a review whose UI waits for a designer reviews it whole (--skip-design lead): it is with the
      // lead, named — never "nobody yet" in the UI's column while the lead says it is reviewing it.
      name: '◎ lead review',
      tone: chalk.magenta,
      tasks: of('in-review').filter(task => task.design?.status !== 'due' || task.reviewer !== undefined),
      who: task => task.reviewer ?? 'waiting'
    },
    // The latest approval first: what just landed is what a person following the run looks for.
    {
      name: '✓ approved',
      tone: chalk.green,
      tasks: of('done').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
  ];
};

/** How many stages a band of the flow holds at this width: all of them on a wide screen, fewer to a row on a narrow one. */
const stagesPerBand = (width: number, stages: number): number =>
  Math.min(stages, Math.max(1, Math.floor((width + GAP) / (MIN_STAGE + GAP))));

/** Where a stage's column is in the flow's lines — its rows and its columns — and how far down its cards may go. */
export interface FlowColumn {
  stage: number;
  rows: [number, number];
  cols: [number, number];
  /** The furthest its cards scroll: its tasks past the ones shown. */
  max: number;
}

/** The flow drawn, and where each of its stages' columns is: what the wheel over one scrolls. */
export interface FlowBoard {
  lines: string[];
  columns: FlowColumn[];
}

/**
 * The run as a flow, from to-do to approved — the board's kanban: each stage with how many tasks stand in it and which,
 * what holds an agent back, the review split in its UI's and the lead's, and what is sent back. Drawn to the width: the
 * stages in one band on a wide screen, in bands one under the other on a narrow one; `depth` cards a stage at most, the
 * rest counted — and scrolled to, a stage at a time, by `offsets` (by stage, as `columns` says them).
 */
export const flowBoard = (
  tasks: readonly TaskLine[],
  width: number,
  { depth = 8, offsets = new Map<number, number>() }: { depth?: number; offsets?: ReadonlyMap<number, number> } = {}
): FlowBoard => {
  const stages = stagesOf(tasks);
  const perBand = stagesPerBand(width - LEAD, stages.length);
  const stageWidth = Math.min(MAX_STAGE, Math.floor((width - LEAD - GAP * (perBand - 1)) / perBand));
  const fit = (text: string) => cell(text, stageWidth);
  const arrow = chalk.dim(' ─▶ ');
  const bands = Array.from({ length: Math.ceil(stages.length / perBand) }, (_, index) =>
    stages.slice(index * perBand, (index + 1) * perBand)
  );
  const columns: FlowColumn[] = [];
  // The flow's title is its first line: each band's lines are counted after it.
  let top = 1;

  const bandLines = (band: Stage[], index: number): string[] => {
    // Each stage after the first, past an arrow. A band that goes on from the one above starts with an arrow of its
    // own: the flow reads on.
    const joined = (cells: string[], edge: string) =>
      cells.map((each, at) => (at === 0 ? each : `${edge}${each}`)).join('');
    const lead = index === 0 ? ' '.repeat(LEAD) : chalk.dim('▶ ');
    const head = joined(
      band.map(stage => fit(stage.tone(chalk.bold(`${stage.name} (${String(stage.tasks.length)})`)))),
      arrow
    );
    const deepest = Math.min(depth, Math.max(0, ...band.map(stage => stage.tasks.length)));
    // How far down each stage's cards are scrolled: never past its last card.
    const from = band.map((stage, at) =>
      Math.min(offsets.get(index * perBand + at) ?? 0, Math.max(0, stage.tasks.length - deepest))
    );
    const rows = Array.from({ length: deepest }, (_, row) =>
      joined(
        band.map((stage, at) => {
          const task = stage.tasks.at(from[at] + row);

          // A name longer than its column cut in the middle, as the tasks' list cuts one: its ends tell it apart.
          const name = task ? nameOf(task) : undefined;
          const mark = task ? markOf(task) : { text: '', width: 0 };
          const who = task && stage.who ? stage.who(task) : '';
          // Who it is with keeps its place: the id gives way first, cut in its middle — cut at the card's end, a long id
          // took the name with it, and the lead's review read nobody's ("t-desk-selector-ai…").
          const room = stageWidth - mark.width - (who ? Math.min(who.length + 1, stageWidth - mark.width - MIN_ID) : 0);
          const id = name && name.length > room ? idCell(name, room).trimEnd() : name;

          return task && id ? fit(`${mark.text}${stage.tone(id)}${who ? chalk.dim(` ${who}`) : ''}`) : fit('');
        }),
        '    '
      )
    );
    const more = band.some(stage => stage.tasks.length > deepest)
      ? [
          chalk.dim(
            joined(
              band.map((stage, at) => {
                const below = stage.tasks.length - deepest - from[at];

                return fit(
                  [from[at] > 0 ? `↑ ${String(from[at])}` : '', below > 0 ? `+ ${String(below)} more` : '']
                    .filter(Boolean)
                    .join(' · ')
                );
              }),
              '    '
            )
          )
        ]
      : [];
    const lines = [`${lead}${head}`, ...[...rows, ...more].map(row => `${' '.repeat(LEAD)}${row}`)];
    band.forEach((stage, at) => {
      const left = LEAD + at * (stageWidth + GAP);
      columns.push({
        stage: index * perBand + at,
        rows: [top, top + lines.length],
        cols: [left, left + stageWidth],
        max: Math.max(0, stage.tasks.length - deepest)
      });
    });
    top += lines.length;

    return lines.map(line => cell(line, width));
  };

  return {
    lines: [
      cell(
        chalk.bold('FLOW') +
          chalk.dim(
            `  each task left to right, from to-do to approved · ↺2 sent back, at work again at round 2 · ${chalk.red('‼')} critical, ${chalk.yellow('!')} high (its own or a task’s waiting on it) · the wheel scrolls a stage · f hides it`
          ),
        width
      ),
      ...bands.flatMap(bandLines)
    ],
    columns
  };
};

/** The flow's lines alone, as `flowBoard` draws them. */
export const flowLines = (
  tasks: readonly TaskLine[],
  width: number,
  options: { depth?: number; offsets?: ReadonlyMap<number, number> } = {}
): string[] => flowBoard(tasks, width, options).lines;

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
 * The flow as deep as `rows` lets it be: its stages' cards cut to fewer a stage — and, where not even a card a stage
 * fits, each stage's count in a line or two: the kanban is what the board is for, never left out.
 */
export const fittedFlow = (
  tasks: readonly TaskLine[],
  width: number,
  rows: number,
  offsets: ReadonlyMap<number, number> = new Map()
): FlowBoard => {
  for (let depth = 8; depth >= 1; depth -= 1) {
    const board = flowBoard(tasks, width, { depth, offsets });
    if (board.lines.length <= rows) {
      return board;
    }
  }

  return { lines: countsOnly(tasks, width), columns: [] };
};
