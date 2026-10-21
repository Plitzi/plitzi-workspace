import { watch } from 'node:fs';
import { emitKeypressEvents } from 'node:readline';

import chalk from 'chalk';

import { attentionLines } from './monitorAttention';
import { bodyOf, detailOf, listedTasks, orderedTasks } from './monitorBoard';
import { cell, hhmm, wrapped } from './monitorCells';
import { FEED_LOOK, FEED_WORDS, feedColumns, feedRow, groupKey, repeatRow } from './monitorFeed';
import { fittedFlow } from './monitorFlow';
import { contextFor } from './shell';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns, runIds } from '../../runs/run';

import type { FlowColumn } from './monitorFlow';
import type { RunCommandOptions } from './shell';
import type { Monitored } from '../../runs/monitor';
import type { RunContext } from '../../runs/run';
import type { TaskLine } from '../../runs/view';

/**
 * `plitzi run monitor`: a person's panel over a run, in a terminal of its own beside the harness's — the run it shows
 * on top, its tasks and where each stands, every agent with its model and what it is at, and what happened last: takes,
 * reviews and their verdicts, messages. It only reads — no message is marked read, nothing the lead is woken for is
 * touched — so the agents never notice it. A shell with no terminal (an agent's) is refused: theirs is `run watch`.
 */

/** How the head counts tasks in each state. */
const STATUS_WORDS: Record<TaskLine['status'], string> = {
  'in-progress': 'at work',
  spike: 'in spike',
  'changes-requested': 'sent back',
  'in-review': 'in review',
  waiting: 'waiting',
  blocked: 'blocked',
  failed: 'failed',
  ready: 'free to take',
  pending: 'pending',
  done: 'approved'
};

/** A mouse report in SGR form: the button, the column, the row, and M pressed or m released. */
// eslint-disable-next-line no-control-regex -- a terminal's mouse report starts with ESC: it is what is matched
const MOUSE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

/** The attention rows shown on top: the board is for seeing it all, the full list is `run status`. */
const ATTENTION_ROWS = 5;

/** Under it the head says only the run and its counts: the goal and the preview are for a taller terminal. */
const SHORT_HEIGHT = 32;
/** The activity's events the board leaves room for: a fifth of it, from these to these — and then whatever it leaves. */
const MIN_EVENTS = 3;
const MAX_EVENTS = 10;
/** The activity's own rows above its events: a blank, its title, its columns' names. */
const ACTIVITY_HEAD = 3;
/** From this height on the activity always has its few events; under it, the board takes the rows. */
const MIN_ACTIVITY_HEIGHT = 24;
/** The fewest rows the tasks and agents are given, whatever is left. */
const MIN_BODY = 4;
/** The panel, as lines that fit `width` × `height`: the run, attention, the flow, tasks and agents, then the feed. */
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
    flow = true,
    flowOffsets = new Map<number, number>()
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
    /** The run's flow, the board's kanban, above the tasks and agents — `f` hides it. */
    flow?: boolean;
    /** How far down each of the flow's stages is scrolled, by stage (`FlowColumn.stage`). */
    flowOffsets?: ReadonlyMap<number, number>;
    /** Told which page of the activity each group's line is on: an opened group is shown on its page. */
    onGroupPages?: (pages: Map<string, number>) => void;
    /** Told which rows the tasks and the activity take (first, after the last; 0 the top): where the wheel scrolls what. */
    onRegions?: (regions: Regions) => void;
  }
): string[] => {
  const { view, agents, feed, runs, stories, stage } = data;
  const others = runs.filter(run => run.runId !== view.runId);
  const tasks = orderedTasks(view.tasks);
  const counts = (['in-progress', 'changes-requested', 'in-review', 'waiting', 'blocked', 'ready', 'pending'] as const)
    .map(status => [status, tasks.filter(task => task.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${String(count)} ${STATUS_WORDS[status]}`);
  const asking = tasks.filter(task => task.asking !== undefined && task.asking.answered !== true).length;
  if (asking > 0) {
    counts.push(chalk.yellow(`${String(asking)} asking the lead`));
  }

  // A short terminal keeps the run's line and its counts; the goal and the preview are for a tall one.
  const short = height < SHORT_HEIGHT;
  const preview = `${view.previewPort === undefined ? chalk.dim('preview: npm run start:preview') : `preview: http://127.0.0.1:${String(view.previewPort)}`}${others.length > 0 ? chalk.dim(` · other runs: ${others.map(run => `${run.runId} (${run.status})`).join(', ')}`) : ''}`;
  const head = [
    chalk.inverse(
      cell(
        ` RUN ${view.runId}${stage ? ` · stage ${String(stage.of)}: ${stage.name}` : ''} · ${view.status.toUpperCase()} · ${String(view.done)} of ${String(view.total)} approved${view.expectedEnd ? ` · expected end ${hhmm(view.expectedEnd)} UTC` : ''} · ${hhmm(now.toISOString())} UTC`,
        width
      )
    ),
    // The stage at work, when stages were stacked: what is being done now, not the run's first goal.
    ...(short ? [] : [chalk.dim(cell(` ${stage?.goal ?? view.goal}`, width))]),
    cell(
      ` ${counts.length > 0 ? counts.join(' · ') : 'nothing at work'}${short ? chalk.dim(' · ') + preview : ''}`,
      width
    ),
    ...(short ? [] : [cell(` ${preview}`, width)]),
    ''
  ];
  // What may need a supervisor: on top, under the run's head — the rest of the board is what is going on.
  const attentionRows = short ? 2 : ATTENTION_ROWS;
  const attention =
    view.attention.length === 0
      ? [cell(chalk.green(' ✓ nothing needs anyone now'), width)]
      : [
          chalk.bold.yellow(` NEEDS ATTENTION (${String(view.attention.length)})`),
          ...attentionLines(view, width, attentionRows),
          ...(view.attention.length > attentionRows
            ? [chalk.dim(`   + ${String(view.attention.length - attentionRows)} more — plitzi run status`)]
            : [])
        ];
  // The keys and the activity's marks, wrapped to the width rather than cut: on a narrow terminal each still says them.
  const keys = wrapped(
    [
      'q quits',
      `f ${flow ? 'hides' : 'shows'} the flow`,
      '↑↓ a task',
      'enter opens it',
      'a the approved',
      '←→ the activity',
      ...(short
        ? []
        : ['"after X": starts once X is approved', '○ free to take', '■ needs someone', '‼ critical', '! high'])
    ],
    width
  ).map(line => chalk.dim(line));
  const marks = wrapped(
    [
      'activity:',
      ...(
        ['take', 'complete', 'review', 'approved', 'sent-back', 'message', 'question', 'problem', 'run'] as const
      ).map(kind => `${FEED_LOOK[kind].mark} ${chalk.dim(FEED_WORDS[kind])}`)
    ],
    width,
    '  '
  );
  const foot = ['', ...keys, ...marks];

  // What is left under the head, the attention and the keys, shared by what matters most first: the flow — the board's
  // kanban, where every task stands — then the tasks and agents, then the activity: a fifth or so, and every row the tasks — fifteen at most — leave.
  const room = Math.max(0, height - head.length - attention.length - 1 - foot.length);
  const listed = listedTasks(view.tasks, showApproved);
  const picked = listed.at(selected);
  // A few events of the activity on any terminal of a usual height; on a shorter one it gives its rows to the board.
  const leastActivity = height >= MIN_ACTIVITY_HEIGHT ? MIN_EVENTS + ACTIVITY_HEAD : 0;
  // A task opened says all it can in what the board and the activity leave: its files are the last of it, cut first.
  const detail =
    open && picked
      ? ['', ...detailOf(picked, stories[picked.id]).map(line => cell(line, width))].slice(
          0,
          Math.max(2, room - MIN_BODY - 3 - leastActivity)
        )
      : [];
  const flowBoard = flow
    ? fittedFlow(
        view.tasks,
        width,
        Math.min(Math.round(room * 0.4), room - leastActivity - MIN_BODY - detail.length - 1),
        flowOffsets
      )
    : { lines: [], columns: [] };
  const board = flowBoard.lines;
  const besideBoard = board.length > 0 ? 1 : 0;
  const wanted = Math.min(MAX_EVENTS, Math.max(MIN_EVENTS, Math.round(room * 0.2))) + ACTIVITY_HEAD;
  const bodyRoom = Math.max(
    MIN_BODY,
    room - board.length - besideBoard - detail.length - Math.max(leastActivity, Math.min(wanted, room - MIN_BODY))
  );
  const { lines: body, tasks: taskRows } = bodyOf({
    tasks,
    listed,
    agents,
    stories,
    selected,
    open,
    showApproved,
    width,
    rows: bodyRoom,
    now
  });
  // Every row the board leaves — the tasks listed fifteen at most — is the activity's.
  const left = Math.max(0, room - board.length - besideBoard - body.length - detail.length - ACTIVITY_HEAD);
  // The activity's rows: each event, and under an opened group each of its repeats.
  type Row = { row: string; key?: string };
  const feedWidths = feedColumns([...feed, ...feed.flatMap(line => line.repeats ?? [])], width);
  const blocks: Row[][] = feed.map(line =>
    line.count !== undefined && opened.has(groupKey(line))
      ? [
          { row: feedRow(line, feedWidths, true), key: groupKey(line) },
          ...(line.repeats ?? []).map(each => ({ row: repeatRow(each, feedWidths) }))
        ]
      : [{ row: feedRow(line, feedWidths), ...(line.count === undefined ? {} : { key: groupKey(line) }) }]
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
          cell(
            `${chalk.bold('ACTIVITY')}${chalk.dim(
              pages > 1
                ? `  ${String(firstLine + 1)}–${String(firstLine + shownRows.length)} of ${String(rows.length)} · ${page > 0 ? '← newer' : '← (newest)'} · ${page < pages - 1 ? 'older →' : '(oldest) →'} · the wheel too`
                : `  ${String(rows.length)}, all shown`
            )}`,
            width
          ),
          chalk.dim(
            cell(
              `  ${'TIME'.padEnd(5)}   ${'WHO'.padEnd(feedWidths.who)} ${'TASK'.padEnd(feedWidths.task)} WHAT`,
              width
            )
          ),
          ...shownRows.map(each => cell(each.row, width))
        ];

  const boardTop = head.length + attention.length + 1;
  const bodyTop = boardTop + board.length + besideBoard;
  // Where each group's line lands on the screen: the rows above it, then the activity's title and column names.
  const above = bodyTop + body.length + detail.length + ACTIVITY_HEAD;
  onGroupRows?.(
    new Map(shownRows.flatMap((each, index) => (each.key === undefined ? [] : [[above + index, each.key] as const])))
  );
  onRegions?.({
    flow: flowBoard.columns.map(column => ({
      ...column,
      rows: [boardTop + column.rows[0], boardTop + column.rows[1]] as [number, number]
    })),
    tasks: [bodyTop + taskRows[0], bodyTop + taskRows[1]],
    // Its title and its columns' names too: the wheel turns its pages anywhere over it.
    activity: [above - (ACTIVITY_HEAD - 1), above + shownRows.length]
  });

  return [...head, ...attention, '', ...board, ...(besideBoard ? [''] : []), ...body, ...detail, ...activity, ...foot];
};

/** Where on the screen the wheel scrolls something (rows and columns from 0): each of the flow's stages, the tasks, the activity. */
export interface Regions {
  flow: FlowColumn[];
  tasks: [number, number];
  activity: [number, number];
}

/**
 * What the wheel scrolls at a row and column of the screen: a stage of the flow — its cards — the tasks' list, or the
 * activity's pages; nothing over the rest (the head, the keys), which once turned the activity's pages under the flow.
 */
export const wheelTarget = (
  row: number,
  column: number,
  regions: Regions
): { stage: FlowColumn } | 'tasks' | 'activity' | undefined => {
  const stage = regions.flow.find(
    each => row >= each.rows[0] && row < each.rows[1] && column >= each.cols[0] && column < each.cols[1]
  );
  if (stage) {
    return { stage };
  }

  return row >= regions.tasks[0] && row < regions.tasks[1]
    ? 'tasks'
    : row >= regions.activity[0] && row < regions.activity[1]
      ? 'activity'
      : undefined;
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
  // The flow is the board's kanban: shown from the start, `f` hides it.
  let flow = true;
  // The groups of repeated events opened by a click, and which screen row is which group's line, as last drawn.
  const opened = new Set<string>();
  let groupRows = new Map<number, string>();
  let groupPages = new Map<string, number>();
  let regions: Regions = { flow: [], tasks: [0, 0], activity: [0, 0] };
  // How far down each of the flow's stages the wheel scrolled its cards.
  const flowOffsets = new Map<number, number>();
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
          flowOffsets,
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

        // At most a read every 150 ms, never pushed back by the next change: a run written to without a pause — five
        // agents at work, a stage stacked — was otherwise never read again until the clock's fallback.
        soon ??= setTimeout(() => {
          soon = undefined;
          void look();
        }, 150);
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
    } catch {
      // Whatever a read met, the board stays up and reads again: a monitor a person watches never ends on its own.
      setTimeout(() => void look(), 1000);
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
        // Read while the CLI was writing it — a plan half written as a stage is stacked: the board stays as it was and is
        // read again in a moment. Thrown, it ended the monitor.
        if (!isRunRefusal(error)) {
          setTimeout(() => void look(), 500);

          return;
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
      for (const [, button, column, row, kind] of data.toString('utf-8').matchAll(MOUSE)) {
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
          // The wheel scrolls what it is over: a stage of the flow its cards, the tasks' list its selection, the
          // activity its pages.
          const at = Number(row) - 1;
          const up = button === '64';
          const count = last ? listedTasks(last.view.tasks, showApproved).length : 0;
          const over = wheelTarget(at, Number(column) - 1, regions);
          if (typeof over === 'object') {
            const now = flowOffsets.get(over.stage.stage) ?? 0;
            flowOffsets.set(over.stage.stage, Math.min(over.stage.max, Math.max(0, now + (up ? -1 : 1))));
          } else if (over === 'tasks' && count > 0) {
            selected = up ? Math.max(0, selected - 1) : Math.min(count - 1, selected + 1);
          } else if (over === 'activity') {
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
