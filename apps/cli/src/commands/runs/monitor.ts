import { watch } from 'node:fs';
import { emitKeypressEvents } from 'node:readline';

import chalk from 'chalk';

import { ago, cell, hhmm, ID_WIDTH, idCell } from './monitorCells';
import { FEED_LOOK, FEED_WORDS, feedRow, groupKey, repeatRow, WHO_WIDTH } from './monitorFeed';
import { flowLines } from './monitorFlow';
import { contextFor } from './shell';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns, runIds } from '../../runs/run';

import type { RunCommandOptions } from './shell';
import type { AgentLine, AgentStatus, Monitored, TaskStory } from '../../runs/monitor';
import type { RunContext } from '../../runs/run';
import type { TaskLine } from '../../runs/view';

/**
 * `plitzi run monitor`: a person's panel over a run, in a terminal of its own beside the harness's — the run it shows
 * on top, its tasks and where each stands, every agent with its model and what it is at, and what happened last: takes,
 * reviews and their verdicts, messages. It only reads — no message is marked read, nothing the lead is woken for is
 * touched — so the agents never notice it. A shell with no terminal (an agent's) is refused: theirs is `run watch`.
 */

const TASK_STATE: Record<TaskLine['status'], (task: TaskLine) => string> = {
  pending: task => chalk.dim(task.waitsOn ? `· after ${task.waitsOn.join(', ')}` : '· pending'),
  ready: () => '○ ready — free to take',
  'in-progress': task =>
    task.asking
      ? chalk.yellow(`? ${task.agent ?? ''} asks the lead (${task.asking.id})`)
      : chalk.cyan(
          `▶ ${task.agent ?? ''}${task.fraction === undefined ? '' : ` ${String(Math.round(task.fraction * 100))}%`}`
        ),
  waiting: task => chalk.yellow(`… waits ${task.waitingFor?.task ?? ''}`),
  'in-review': task =>
    chalk.magenta(
      task.design?.status === 'due'
        ? `◎ UI review · ${task.design.by ?? 'no designer yet'} → lead`
        : `◎ lead review · ${task.reviewer ?? 'no lead yet'}`
    ),
  'changes-requested': task => chalk.yellow(`↺ round ${String(task.round)} · ${task.agent ?? ''}`),
  done: () => chalk.green('✓ approved'),
  blocked: task => chalk.red(`■ blocked${task.blockedBy ? ` · needs ${task.blockedBy.needs}` : ''}`),
  failed: () => chalk.red('✗ failed')
};

/** How the head counts tasks in each state. */
const STATUS_WORDS: Record<TaskLine['status'], string> = {
  'in-progress': 'at work',
  'changes-requested': 'sent back',
  'in-review': 'in review',
  waiting: 'waiting',
  blocked: 'blocked',
  failed: 'failed',
  ready: 'free to take',
  pending: 'pending',
  done: 'approved'
};

const AGENT_STATE: Record<AgentStatus, string> = {
  working: chalk.cyan('● working'),
  reviewing: chalk.magenta('● reviewing'),
  'in-review': chalk.magenta('◐ in review'),
  blocked: chalk.yellow('● blocked'),
  asking: chalk.yellow('? asks the lead'),
  waiting: chalk.cyan('◌ waiting'),
  idle: chalk.dim('○ idle'),
  stopped: chalk.dim('◼ stopped'),
  done: chalk.green('✓ done'),
  'not-started': chalk.dim('· not started'),
  'no-signal': chalk.red('● no signal')
};

/** A mouse report in SGR form: the button, the column, the row, and M pressed or m released. */
// eslint-disable-next-line no-control-regex -- a terminal's mouse report starts with ESC: it is what is matched
const MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** The attention rows shown on top: the board is for seeing it all, the full list is `run status`. */
const ATTENTION_ROWS = 5;

/** A model's short name: what the line has room for. */
const shortModel = (model: string | undefined): string => (model ?? 'harness').replace(/^claude-/, '');

/** Where a task stands, the work first: at work, sent back, in review, waiting — then free, pending, and done last. */
const ORDER: Record<TaskLine['status'], number> = {
  'in-progress': 0,
  'changes-requested': 1,
  'in-review': 2,
  waiting: 3,
  blocked: 4,
  failed: 5,
  ready: 6,
  pending: 7,
  done: 8
};

/** The tasks as the panel lists them: by where each stands, the plan's order within. */
export const orderedTasks = (tasks: readonly TaskLine[]): TaskLine[] =>
  tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => ORDER[a.task.status] - ORDER[b.task.status] || a.index - b.index)
    .map(({ task }) => task);

/** The tasks the list shows: all of them, or — the board's default — those not approved yet, the approved said in a line. */
export const listedTasks = (tasks: readonly TaskLine[], showApproved: boolean): TaskLine[] => {
  const ordered = orderedTasks(tasks);
  const left = ordered.filter(task => task.status !== 'done');

  // Nothing left: the approved are all there is to see — listed, never folded into a count.
  return showApproved || left.length === 0 ? ordered : left;
};

const minutesBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 60_000);

/** A task's time against its estimate: spent while it is worked, from its first take to its approval once done. */
const timeOf = (task: TaskLine, story: TaskStory | undefined): string => {
  const spent =
    task.status === 'done' && story?.takenAt && story.approvedAt
      ? minutesBetween(story.takenAt, story.approvedAt)
      : task.spentMinutes;

  return spent === undefined ? '' : `${String(spent)}m of ${String(task.estimateMinutes)}`;
};

/** What follows a task's state on its row: who wrote it, its rounds and its time once done; how long it is as it is. */
const rowTail = (task: TaskLine, story: TaskStory | undefined, now: Date): string => {
  if (task.status === 'pending' || task.status === 'ready') {
    return '';
  }

  const parts =
    task.status === 'done'
      ? [story?.writers.join(', ') ?? '', task.round > 1 ? `${String(task.round)} rounds` : '', timeOf(task, story)]
      : [timeOf(task, story), `${ago(task.updatedAt, now).replace(' ago', '')} as it is`];

  return chalk.dim(
    parts
      .filter(Boolean)
      .map(part => ` · ${part}`)
      .join('')
  );
};

const taskRow = (task: TaskLine, story: TaskStory | undefined, selected: boolean, now: Date): string =>
  `${selected ? chalk.inverse('›') : ' '} ${idCell(task.id)} ${TASK_STATE[task.status](task)}${rowTail(task, story, now)}`;

const ROLE_SHORT: Record<string, string> = { developer: 'dev', designer: 'design', tester: 'test', writer: 'write' };

/** An agent's row: who, its model and roles, where it stands, when last heard and what it got approved — then what it
 * does, which the screen may cut. */
const agentRow = (agent: AgentLine, now: Date): string =>
  `${chalk.bold(agent.agent.padEnd(9))} ${chalk.dim(`${shortModel(agent.model)}${agent.kind === 'agent' && agent.roles.length > 0 ? ` · ${agent.roles.map(role => ROLE_SHORT[role] ?? role).join('+')}` : ''}`.padEnd(20))} ${AGENT_STATE[agent.status]}${chalk.dim(`${agent.signalAt ? ` ${ago(agent.signalAt, now)}` : ''}${agent.approved > 0 ? ` · ✓${String(agent.approved)}` : ''}`)} · ${agent.doing}`;

/** Who did what of a task, said in a line each: its writers, its UI's review, its approval. */
const storyOf = (task: TaskLine, story: TaskStory | undefined): string[] =>
  story === undefined
    ? []
    : [
        ...(story.writers.length > 0
          ? [`  written by ${story.writers.join(', then ')}${story.takenAt ? ` from ${hhmm(story.takenAt)} UTC` : ''}`]
          : []),
        ...(story.design === 'skipped'
          ? ['  its UI: the lead went first (--skip-design)']
          : story.design
            ? [`  its UI approved by ${story.design}`]
            : []),
        ...(story.approvedAt
          ? [
              `  approved by ${story.approvedBy ?? 'lead'} at ${hhmm(story.approvedAt)} UTC${timeOf(task, story) ? ` — ${timeOf(task, story)} min` : ''}`
            ]
          : []),
        ...(story.sentBack > 0 || story.failedChecks > 0
          ? [
              chalk.yellow(
                `  ${[story.sentBack > 0 ? `sent back ${String(story.sentBack)}×` : '', story.failedChecks > 0 ? `${String(story.failedChecks)} failed check${story.failedChecks === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}`
              )
            ]
          : [])
      ];

const detailOf = (task: TaskLine, story: TaskStory | undefined): string[] => [
  chalk.bold(`${task.id} — ${task.title}`),
  `  ${task.status}${task.round > 0 ? ` · round ${String(task.round)}` : ''} · ${task.role} · ${task.priority} · ${String(task.estimateMinutes)} min estimated${task.status !== 'done' && task.spentMinutes !== undefined ? `, ${String(task.spentMinutes)} spent` : ''}`,
  ...storyOf(task, story),
  ...(task.asking ? [chalk.yellow(`  asks the lead (${task.asking.id}): ${task.asking.text}`)] : []),
  ...(task.step ? [`  now: ${task.step}`] : []),
  ...(task.waitsOn
    ? [`  starts once ${task.waitsOn.join(', ')} ${task.waitsOn.length === 1 ? 'is' : 'are'} approved`]
    : []),
  ...(task.waitingFor
    ? [chalk.yellow(`  waits for ${task.waitingFor.task}${task.waitingFor.file ? `: ${task.waitingFor.file}` : ''}`)]
    : []),
  ...(task.blockedBy ? [chalk.red(`  blocked: ${task.blockedBy.reason}`)] : []),
  ...(task.unblocks.length > 0 ? [`  then: ${task.unblocks.join(', ')}`] : []),
  ...task.files.map(file => chalk.dim(`  ${file}`))
];

/** Two columns side by side, each its width: the tasks and the agents. */
const columns = (left: string[], right: string[], leftWidth: number, rightWidth: number): string[] =>
  Array.from(
    { length: Math.max(left.length, right.length) },
    (_, index) => `${cell(left[index] ?? '', leftWidth)} │ ${cell(right[index] ?? '', rightWidth)}`
  );

/** The panel, as lines that fit `width` × `height`: the run, tasks beside agents, attention, then the feed. */
export const monitorScreen = (
  data: Monitored,
  {
    selected,
    open,
    width,
    height,
    now,
    feedPage = 0,
    onFeedPages,
    showApproved = false,
    opened = new Set<string>(),
    onGroupRows,
    onGroupPages,
    onRegions,
    flow = false
  }: {
    selected: number;
    open: boolean;
    width: number;
    height: number;
    now: Date;
    /** Which page of the activity, newest first: 0 is the latest, each → one older. */
    feedPage?: number;
    /** Told how many pages the activity has at this height: what → may go up to. */
    onFeedPages?: (pages: number) => void;
    /** The approved tasks listed one by one too (`a`); otherwise said in one line under the rest. */
    showApproved?: boolean;
    /** The groups of repeated events opened, by `groupKey`: each repeat shown under its line. */
    opened?: ReadonlySet<string>;
    /** Told which row of the screen is which group's line (0 the top): what a click there opens or folds. */
    onGroupRows?: (rows: Map<number, string>) => void;
    /** The run's flow drawn in the place of the tasks and agents (`f`). */
    flow?: boolean;
    /** Told which page of the activity each group's line is on: an opened group is shown on its page. */
    onGroupPages?: (pages: Map<string, number>) => void;
    /** Told which rows the tasks and the activity take (first, after the last; 0 the top): where the wheel scrolls what. */
    onRegions?: (regions: { tasks: [number, number]; activity: [number, number] }) => void;
  }
): string[] => {
  const { view, agents, feed, runs, stories } = data;
  const others = runs.filter(run => run.runId !== view.runId);
  const tasks = orderedTasks(view.tasks);
  const counts = (['in-progress', 'changes-requested', 'in-review', 'waiting', 'blocked', 'ready', 'pending'] as const)
    .map(status => [status, tasks.filter(task => task.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${String(count)} ${STATUS_WORDS[status]}`);
  const asking = tasks.filter(task => task.asking !== undefined).length;
  if (asking > 0) {
    counts.push(chalk.yellow(`${String(asking)} asking the lead`));
  }

  const head = [
    chalk.inverse(
      cell(
        ` RUN ${view.runId} · ${view.status.toUpperCase()} · ${String(view.done)} of ${String(view.total)} approved${view.expectedEnd ? ` · expected end ${hhmm(view.expectedEnd)} UTC` : ''} · ${hhmm(now.toISOString())} UTC`,
        width
      )
    ),
    chalk.dim(cell(` ${view.goal}`, width)),
    cell(` ${counts.length > 0 ? counts.join(' · ') : 'nothing at work'}`, width),
    cell(
      ` ${view.previewPort === undefined ? chalk.dim('preview: npm run start:preview') : `preview: http://127.0.0.1:${String(view.previewPort)}`}${others.length > 0 ? chalk.dim(` · other runs: ${others.map(run => `${run.runId} (${run.status})`).join(', ')}`) : ''}`,
      width
    ),
    ''
  ];
  const leftWidth = Math.max(30, Math.floor(width * 0.42));
  const rightWidth = Math.max(10, width - leftWidth - 3);
  // What may need a supervisor: on top, under the run's head — the rest of the board is what is going on.
  const attention =
    view.attention.length === 0
      ? [cell(chalk.green(' ✓ nothing needs anyone now'), width)]
      : [
          chalk.bold.yellow(` NEEDS ATTENTION (${String(view.attention.length)})`),
          ...view.attention
            .slice(0, ATTENTION_ROWS)
            .map(item =>
              cell(` ${item.who === 'person' ? chalk.red('■ you:') : chalk.yellow('⚠ lead:')} ${item.text}`, width)
            ),
          ...(view.attention.length > ATTENTION_ROWS
            ? [chalk.dim(`   + ${String(view.attention.length - ATTENTION_ROWS)} more — plitzi run status`)]
            : [])
        ];
  // The tasks a screen has room for, the selected one in them: a run of thirty would push everything else off.
  const room = Math.max(6, Math.floor((height - head.length - attention.length - 1) / 2) - 1);
  const listed = listedTasks(view.tasks, showApproved);
  const approved = tasks.length - tasks.filter(task => task.status !== 'done').length;
  const first = Math.min(Math.max(0, selected - Math.floor(room / 2)), Math.max(0, listed.length - room));
  const shown = listed.slice(first, first + room);
  const body = columns(
    [
      chalk.bold(
        `TASKS (${String(tasks.length)})${listed.length > room ? chalk.dim(` ${String(first + 1)}–${String(first + shown.length)}`) : ''}`
      ) +
        chalk.dim(
          `  ↑↓ choose · enter ${open ? 'closes' : 'opens'} it${tasks.some(task => task.status !== 'done') ? ` · a ${showApproved ? 'hides' : 'shows'} the approved` : ''}`
        ),
      ...shown.map((task, index) => taskRow(task, stories[task.id], first + index === selected, now)),
      ...(first + shown.length < listed.length
        ? [chalk.dim(`  ↓ ${String(listed.length - first - shown.length)} more`)]
        : []),
      ...(listed.length < tasks.length
        ? [
            chalk.green(`  ✓ ${String(approved)} approved`) +
              chalk.dim(
                ` (a lists them): ${tasks
                  .filter(task => task.status === 'done')
                  .map(task => task.id)
                  .join(', ')}`
              )
          ]
        : [])
    ],
    [chalk.bold(`AGENTS (${String(agents.length)})`), ...agents.map(agent => agentRow(agent, now))],
    leftWidth,
    rightWidth
  );
  const picked = listed.at(selected);
  // The flow (`f`) in the place of the tasks and agents: where every task stands, from to-do to approved.
  const board = flow ? flowLines(view.tasks, width) : body;
  const detail =
    !flow && open && picked ? ['', ...detailOf(picked, stories[picked.id]).map(line => cell(line, width))] : [];
  const foot = [
    '',
    chalk.dim(
      cell(
        'q quits · f the flow · ↑↓ a task · enter opens it · a the approved · ←→ the activity · "after X": starts once X is approved · ○ free to take · ■ needs someone',
        width
      )
    ),
    cell(
      chalk.dim('activity: ') +
        (['take', 'complete', 'review', 'approved', 'sent-back', 'message', 'question', 'problem', 'run'] as const)
          .map(kind => `${FEED_LOOK[kind].mark} ${chalk.dim(FEED_WORDS[kind])}`)
          .join('  '),
      width
    )
  ];
  const left = Math.max(
    0,
    height - head.length - attention.length - 1 - board.length - detail.length - foot.length - 3
  );
  // The activity's rows: each event, and under an opened group each of its repeats.
  type Row = { row: string; key?: string };
  const blocks: Row[][] = feed.map(line =>
    line.count !== undefined && opened.has(groupKey(line))
      ? [
          { row: feedRow(line, true), key: groupKey(line) },
          ...(line.repeats ?? []).map(each => ({ row: repeatRow(each) }))
        ]
      : [{ row: feedRow(line), ...(line.count === undefined ? {} : { key: groupKey(line) }) }]
  );
  // Paged by event, never splitting an opened group: its repeats are on the page its line is on.
  const pagesOf: Row[][] = [];
  let filling: Row[] = [];
  for (const block of left === 0 ? [] : blocks) {
    if (filling.length > 0 && filling.length + block.length > left) {
      pagesOf.push(filling);
      filling = [];
    }

    filling.push(...block.slice(0, left));
  }

  if (filling.length > 0) {
    pagesOf.push(filling);
  }

  onGroupPages?.(
    new Map(
      pagesOf.flatMap((each, index) => each.flatMap(row => (row.key === undefined ? [] : [[row.key, index] as const])))
    )
  );
  const rows = blocks.flat();
  const pages = Math.max(1, pagesOf.length);
  onFeedPages?.(pages);
  const page = Math.min(Math.max(0, feedPage), pages - 1);
  const firstLine = pagesOf.slice(0, page).reduce((sum, each) => sum + each.length, 0);
  const shownRows = pagesOf.at(page) ?? [];
  const activity =
    left === 0
      ? []
      : [
          '',
          `${chalk.bold('ACTIVITY')}${chalk.dim(
            pages > 1
              ? `  ${String(firstLine + 1)}–${String(firstLine + shownRows.length)} of ${String(rows.length)} · ${page > 0 ? '← newer' : '← (newest)'} · ${page < pages - 1 ? 'older →' : '(oldest) →'} · the wheel too`
              : `  ${String(rows.length)}, all shown`
          )}`,
          chalk.dim(cell(`  ${'TIME'.padEnd(5)}   ${'WHO'.padEnd(WHO_WIDTH)} ${'TASK'.padEnd(ID_WIDTH)} WHAT`, width)),
          ...shownRows.map(each => cell(each.row, width))
        ];

  // Where each group's line lands on the screen: the rows above it, then the activity's title and column names.
  const above = head.length + attention.length + 1 + board.length + detail.length + 3;
  onGroupRows?.(
    new Map(shownRows.flatMap((each, index) => (each.key === undefined ? [] : [[above + index, each.key] as const])))
  );
  const boardTop = head.length + attention.length + 1;
  onRegions?.({
    tasks: flow ? [0, 0] : [boardTop, boardTop + board.length],
    activity: [above, above + shownRows.length]
  });

  return [...head, ...attention, '', ...board, ...detail, ...activity, ...foot];
};

/** Which run to show: the one named, else the open one, else the newest the project has. */
const runToShow = async (ctx: RunContext, named: string | undefined): Promise<string | undefined> => {
  if (named !== undefined) {
    return named;
  }

  const active = await activeRuns(ctx.root);
  if (active.length > 0) {
    return active[0];
  }

  return (await runIds(ctx.root)).at(-1);
};

export const runMonitor = async (runId: string | undefined, options: RunCommandOptions & { interval?: number }) => {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    const refused = new RunRefusal(
      'invalid',
      'plitzi run monitor draws in a terminal of its own: open it in one beside your harness — an agent, or a script, follows the run with plitzi run watch (--json)'
    );
    console.error(`${chalk.red(`Refused (${refused.code}):`)} ${refused.message}`);
    process.exitCode = refused.exitCode;

    return;
  }

  const ctx = await contextFor(options);
  let selected = 0;
  let open = false;
  let feedPage = 0;
  let feedPages = 1;
  let showApproved = false;
  let flow = false;
  // The groups of repeated events opened by a click, and which screen row is which group's line, as last drawn.
  const opened = new Set<string>();
  let groupRows = new Map<number, string>();
  let groupPages = new Map<string, number>();
  let regions = { tasks: [0, 0], activity: [0, 0] };
  let last: Monitored | undefined;
  let note = 'Reading the run…';

  const draw = (): void => {
    const lines = last
      ? monitorScreen(last, {
          selected,
          open,
          width: process.stdout.columns,
          // One row fewer than the terminal's: the last line written ends the screen, and a full one would scroll it.
          height: process.stdout.rows - 1,
          now: new Date(),
          feedPage,
          showApproved,
          flow,
          opened,
          onGroupRows: rows => {
            groupRows = rows;
          },
          onGroupPages: pages => {
            groupPages = pages;
          },
          onRegions: each => {
            regions = each;
          },
          onFeedPages: pages => {
            feedPages = pages;
            feedPage = Math.min(feedPage, pages - 1);
          }
        })
      : [note];
    // Written over from the top, each line cleared past its end and what is below cleared after — never the screen
    // wiped first, which flickered — inside the terminal's synchronized output, drawn as one frame.
    const shown = lines.slice(0, Math.max(1, process.stdout.rows - 1)).map(line => `${line}\x1b[K`);
    process.stdout.write(`\x1b[?2026h\x1b[H${shown.join('\n')}\x1b[J\x1b[?2026l`);
  };
  // Many events in a moment — a wheel spun, a burst of writes — drawn once, at most every 16 ms.
  let drawing: ReturnType<typeof setTimeout> | undefined;
  const drawSoon = (): void => {
    drawing ??= setTimeout(() => {
      drawing = undefined;
      draw();
    }, 16);
  };

  // Live: the run's folder watched, read again the moment the CLI writes to it — a take, a review, a message, a state —
  // and drawn again every second for the clock and the "ago"s. What a copy writes (cache/) and the blobs are no news
  // for the board. The interval is the fallback, for an event the system did not deliver.
  let watched: { id: string; close: () => void } | undefined;
  let soon: ReturnType<typeof setTimeout> | undefined;
  const follow = (id: string): void => {
    if (watched?.id === id) {
      return;
    }

    watched?.close();
    try {
      const watcher = watch(runPaths(ctx.root, id).dir, { recursive: true }, (_event, file) => {
        const changed = file ?? '';
        if (/(^|\/)(cache|blobs|scratch|shots)(\/|$)/.test(changed)) {
          return;
        }

        clearTimeout(soon);
        soon = setTimeout(() => void look(), 150);
      });
      watched = { id, close: () => watcher.close() };
    } catch {
      watched = undefined;
    }
  };
  let looking = false;
  let lookAgain = false;

  const look = async (): Promise<void> => {
    // One read at a time: one asked for meanwhile runs right after, never beside it.
    if (looking) {
      lookAgain = true;

      return;
    }

    looking = true;
    try {
      await lookOnce();
    } finally {
      looking = false;
      if (lookAgain) {
        lookAgain = false;
        void look();
      }
    }
  };

  const lookOnce = async (): Promise<void> => {
    const id = await runToShow(ctx, runId ?? options.run);
    if (id !== undefined) {
      follow(id);
    }

    if (id === undefined) {
      last = undefined;
      note = 'No run in this project yet — this panel shows one the moment it opens (plitzi run open). q quits.';
    } else {
      try {
        // The whole activity: a person pages back through it (← →), from the plan to now.
        last = await monitorRun(ctx, id, Number.MAX_SAFE_INTEGER);
        selected = Math.min(selected, Math.max(0, listedTasks(last.view.tasks, showApproved).length - 1));
      } catch (error) {
        if (!isRunRefusal(error)) {
          throw error;
        }

        last = undefined;
        note =
          error.code === 'not-found'
            ? `Run "${id}" is gone: it finished, or a person aborted it. Waiting for the next one — q quits.`
            : `${error.code}: ${error.message}`;
      }
    }

    draw();
  };

  await new Promise<void>(resolve => {
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    // The alternate screen, as a pager uses: the terminal's own text is back as it was once it quits.
    // The mouse too (SGR reports): a click on a group of repeated events opens or folds it, the wheel pages the activity.
    process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1006h');
    const timer = setInterval(() => void look(), Math.max(1, options.interval ?? 5) * 1000);
    const clock = setInterval(drawSoon, 1000);
    const quit = (): void => {
      clearInterval(timer);
      clearInterval(clock);
      clearTimeout(soon);
      clearTimeout(drawing);
      watched?.close();
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\x1b[?1000l\x1b[?1006l\x1b[?25h\x1b[?1049l');
      resolve();
    };
    process.stdin.on('data', (data: Buffer) => {
      let changed = false;
      for (const [, button, , row, kind] of data.toString('utf-8').matchAll(MOUSE)) {
        const pressed = kind === 'M';
        if (pressed && button === '0') {
          // Rows are counted from 1 by the terminal, from 0 by the screen drawn.
          const key = groupRows.get(Number(row) - 1);
          if (key !== undefined) {
            if (!opened.delete(key)) {
              opened.add(key);
            }

            // Opened at a page's foot, it no longer fits there: the page it is on now is the one shown.
            draw();
            feedPage = groupPages.get(key) ?? feedPage;
            changed = true;
          }
        } else if (pressed && (button === '64' || button === '65')) {
          // The wheel scrolls what it is over: the tasks' list moves its selection, the activity turns its pages.
          const at = Number(row) - 1;
          const up = button === '64';
          const count = last ? listedTasks(last.view.tasks, showApproved).length : 0;
          if (at >= regions.tasks[0] && at < regions.tasks[1] && count > 0) {
            selected = up ? Math.max(0, selected - 1) : Math.min(count - 1, selected + 1);
          } else {
            feedPage = up ? Math.max(0, feedPage - 1) : Math.min(feedPage + 1, feedPages - 1);
          }

          changed = true;
        }
      }

      if (changed) {
        drawSoon();
      }
    });
    process.stdin.on(
      'keypress',
      (_text: string | undefined, key: { name?: string; ctrl?: boolean; sequence?: string } | undefined) => {
        // A mouse report is read above, never as keys.
        if (key?.sequence?.includes('[<') === true) {
          return;
        }

        if (key?.name === 'q' || (key?.ctrl === true && key.name === 'c')) {
          quit();

          return;
        }

        const count = last ? listedTasks(last.view.tasks, showApproved).length : 0;
        if (key?.name === 'down' && count > 0) {
          selected = (selected + 1) % count;
        } else if (key?.name === 'up' && count > 0) {
          selected = (selected - 1 + count) % count;
        } else if (key?.name === 'return') {
          open = !open;
        } else if (key?.name === 'f') {
          flow = !flow;
        } else if (key?.name === 'a') {
          showApproved = !showApproved;
          selected = 0;
        } else if (key?.name === 'right') {
          feedPage = Math.min(feedPage + 1, feedPages - 1);
        } else if (key?.name === 'left') {
          feedPage = Math.max(0, feedPage - 1);
        }

        draw();
      }
    );
    process.stdout.on('resize', draw);
    void look();
  });
};
