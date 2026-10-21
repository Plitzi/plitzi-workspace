import { emitKeypressEvents } from 'node:readline';
import { stripVTControlCharacters } from 'node:util';

import chalk from 'chalk';

import { contextFor } from './shell';
import { monitorRun } from '../../runs/monitor';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns, runIds } from '../../runs/run';

import type { RunCommandOptions } from './shell';
import type { AgentLine, AgentStatus, FeedLine, Monitored, TaskStory } from '../../runs/monitor';
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
    chalk.cyan(
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
  idle: chalk.dim('○ idle'),
  'not-started': chalk.dim('· not started'),
  'no-signal': chalk.red('● no signal')
};

const FEED_TONE: Record<FeedLine['kind'], (text: string) => string> = {
  take: chalk.cyan,
  complete: chalk.blue,
  review: chalk.magenta,
  message: text => text,
  run: chalk.yellow,
  problem: chalk.red,
  other: chalk.dim
};

const hhmm = (iso: string): string => iso.slice(11, 16);
const visible = (line: string): number => stripVTControlCharacters(line).length;

/** A line cut, or padded, to `width` columns, colours kept — a longer one would wrap and push the screen down. */
const cell = (line: string, width: number): string => {
  const length = visible(line);
  if (length <= width) {
    return line + ' '.repeat(width - length);
  }

  return `${stripVTControlCharacters(line).slice(0, Math.max(0, width - 1))}…`;
};

const ago = (iso: string | undefined, now: Date): string => {
  if (iso === undefined) {
    return '';
  }

  const minutes = Math.round((now.getTime() - Date.parse(iso)) / 60_000);

  return minutes < 1 ? 'now' : `${String(minutes)}m ago`;
};

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

const ID_WIDTH = 22;

/** An id in its column: a long one (an integration's, named by its file) cut in the middle, both ends kept. */
const idCell = (id: string): string =>
  id.length <= ID_WIDTH ? id.padEnd(ID_WIDTH) : `${id.slice(0, 10)}…${id.slice(-(ID_WIDTH - 11))}`;

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
  { selected, open, width, height, now }: { selected: number; open: boolean; width: number; height: number; now: Date }
): string[] => {
  const { view, agents, feed, runs, stories } = data;
  const others = runs.filter(run => run.runId !== view.runId);
  const tasks = orderedTasks(view.tasks);
  const counts = (['in-progress', 'changes-requested', 'in-review', 'waiting', 'blocked', 'ready', 'pending'] as const)
    .map(status => [status, tasks.filter(task => task.status === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${String(count)} ${STATUS_WORDS[status]}`);
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
  // The tasks a screen has room for, the selected one in them: a run of thirty would push everything else off.
  const room = Math.max(6, Math.floor((height - head.length) / 2) - 1);
  const first = Math.min(Math.max(0, selected - Math.floor(room / 2)), Math.max(0, tasks.length - room));
  const shown = tasks.slice(first, first + room);
  const body = columns(
    [
      chalk.bold(
        `TASKS (${String(tasks.length)})${tasks.length > room ? chalk.dim(` ${String(first + 1)}–${String(first + shown.length)}`) : ''}`
      ),
      ...shown.map((task, index) => taskRow(task, stories[task.id], first + index === selected, now)),
      ...(first + shown.length < tasks.length
        ? [chalk.dim(`  ↓ ${String(tasks.length - first - shown.length)} more`)]
        : [])
    ],
    [chalk.bold(`AGENTS (${String(agents.length)})`), ...agents.map(agent => agentRow(agent, now))],
    leftWidth,
    rightWidth
  );
  const attention =
    view.attention.length === 0
      ? []
      : [
          '',
          chalk.bold('NEEDS ATTENTION'),
          ...view.attention.map(item =>
            cell(`${item.who === 'person' ? chalk.red('■') : chalk.yellow('⚠')} ${item.text}`, width)
          )
        ];
  const picked = tasks.at(selected);
  const detail = open && picked ? ['', ...detailOf(picked, stories[picked.id]).map(line => cell(line, width))] : [];
  const foot = [
    '',
    chalk.dim(
      cell(
        '↑↓ a task · enter opens it · q quits · "after X": starts once X is approved · ○ free to take · ■ needs someone',
        width
      )
    )
  ];
  const left = Math.max(0, height - head.length - body.length - attention.length - detail.length - foot.length - 2);
  const activity =
    left === 0
      ? []
      : [
          '',
          chalk.bold('ACTIVITY'),
          ...feed
            .slice(0, left)
            .map(line =>
              cell(
                `${chalk.dim(hhmm(line.at))} ${chalk.bold(line.by.padEnd(14))} ${FEED_TONE[line.kind](line.text)}`,
                width
              )
            )
        ];

  return [...head, ...body, ...attention, ...detail, ...activity, ...foot];
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
  let last: Monitored | undefined;
  let note = 'Reading the run…';

  const draw = (): void => {
    const lines = last
      ? monitorScreen(last, {
          selected,
          open,
          width: process.stdout.columns,
          height: process.stdout.rows,
          now: new Date()
        })
      : [note];
    // The whole screen again, from its top: what a person sees is the run as it is now, never the run scrolled by.
    process.stdout.write(`\x1b[H\x1b[2J${lines.slice(0, process.stdout.rows - 1).join('\n')}`);
  };

  const look = async (): Promise<void> => {
    const id = await runToShow(ctx, runId ?? options.run);
    if (id === undefined) {
      last = undefined;
      note = 'No run in this project yet — this panel shows one the moment it opens (plitzi run open). q quits.';
    } else {
      try {
        last = await monitorRun(ctx, id);
        selected = Math.min(selected, Math.max(0, last.view.tasks.length - 1));
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
    process.stdout.write('\x1b[?1049h\x1b[?25l');
    const timer = setInterval(() => void look(), Math.max(1, options.interval ?? 2) * 1000);
    const quit = (): void => {
      clearInterval(timer);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\x1b[?25h\x1b[?1049l');
      resolve();
    };
    process.stdin.on('keypress', (_text: string | undefined, key: { name?: string; ctrl?: boolean } | undefined) => {
      if (key?.name === 'q' || (key?.ctrl === true && key.name === 'c')) {
        quit();

        return;
      }

      const count = last?.view.tasks.length ?? 0;
      if (key?.name === 'down' && count > 0) {
        selected = (selected + 1) % count;
      } else if (key?.name === 'up' && count > 0) {
        selected = (selected - 1 + count) % count;
      } else if (key?.name === 'return') {
        open = !open;
      }

      draw();
    });
    process.stdout.on('resize', draw);
    void look();
  });
};
