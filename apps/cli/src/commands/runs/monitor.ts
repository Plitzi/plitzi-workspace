import { emitKeypressEvents } from 'node:readline';
import { stripVTControlCharacters } from 'node:util';

import chalk from 'chalk';

import { contextFor } from './shell';
import { monitorRun } from '../../runs/monitor';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns, runIds } from '../../runs/run';

import type { RunCommandOptions } from './shell';
import type { AgentLine, AgentStatus, FeedLine, Monitored } from '../../runs/monitor';
import type { RunContext } from '../../runs/run';
import type { TaskLine } from '../../runs/view';

/**
 * `plitzi run monitor`: a person's panel over a run, in a terminal of its own beside the harness's — the run it shows
 * on top, its tasks and where each stands, every agent with its model and what it is at, and what happened last: takes,
 * reviews and their verdicts, messages. It only reads — no message is marked read, nothing the lead is woken for is
 * touched — so the agents never notice it. A shell with no terminal (an agent's) is refused: theirs is `run watch`.
 */

const TASK_STATE: Record<TaskLine['status'], (task: TaskLine) => string> = {
  pending: () => chalk.dim('· pending'),
  ready: () => '○ ready',
  'in-progress': task =>
    chalk.cyan(
      `▶ ${task.agent ?? ''}${task.fraction === undefined ? '' : ` ${String(Math.round(task.fraction * 100))}%`}`
    ),
  waiting: task => chalk.yellow(`… waits ${task.waitingFor?.task ?? ''}`),
  'in-review': task => chalk.magenta(`◎ review${task.reviewer ? ` · ${task.reviewer}` : ''}`),
  'changes-requested': task => chalk.yellow(`↺ round ${String(task.round)} · ${task.agent ?? ''}`),
  done: () => chalk.green('✓ approved'),
  blocked: () => chalk.red('■ blocked'),
  failed: () => chalk.red('✗ failed')
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

const taskRow = (task: TaskLine, selected: boolean): string =>
  `${selected ? chalk.inverse('›') : ' '} ${task.id.padEnd(18)} ${TASK_STATE[task.status](task)}`;

const agentRow = (agent: AgentLine, now: Date): string =>
  `${chalk.bold(agent.agent.padEnd(9))} ${chalk.dim(shortModel(agent.model).padEnd(11))} ${AGENT_STATE[agent.status]} ${agent.doing}${agent.signalAt ? chalk.dim(` · ${ago(agent.signalAt, now)}`) : ''}`;

const detailOf = (task: TaskLine): string[] => [
  chalk.bold(`${task.id} — ${task.title}`),
  `  ${task.status}${task.round > 0 ? ` · round ${String(task.round)}` : ''} · ${task.role} · ${String(task.estimateMinutes)} min estimated${task.spentMinutes === undefined ? '' : `, ${String(task.spentMinutes)} spent`}`,
  ...(task.step ? [`  now: ${task.step}`] : []),
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
  const { view, agents, feed, runs } = data;
  const others = runs.filter(run => run.runId !== view.runId);
  const head = [
    chalk.inverse(
      cell(
        ` RUN ${view.runId} · ${view.status.toUpperCase()} · ${String(view.done)} of ${String(view.total)} approved${view.expectedEnd ? ` · expected end ${hhmm(view.expectedEnd)} UTC` : ''} · ${hhmm(now.toISOString())} UTC`,
        width
      )
    ),
    chalk.dim(cell(` ${view.goal}`, width)),
    cell(
      ` ${view.previewPort === undefined ? chalk.dim('preview: npm run start:preview') : `preview: http://127.0.0.1:${String(view.previewPort)}`}${others.length > 0 ? chalk.dim(` · other runs: ${others.map(run => `${run.runId} (${run.status})`).join(', ')}`) : ''}`,
      width
    ),
    ''
  ];
  const leftWidth = Math.max(30, Math.floor(width * 0.42));
  const rightWidth = Math.max(10, width - leftWidth - 3);
  const body = columns(
    [
      chalk.bold(`TASKS (${String(view.tasks.length)})`),
      ...view.tasks.map((task, index) => taskRow(task, index === selected))
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
  const detail =
    open && view.tasks[selected] ? ['', ...detailOf(view.tasks[selected]).map(line => cell(line, width))] : [];
  const foot = [
    '',
    chalk.dim(cell('↑↓ a task · enter opens it · q quits — it only reads: the run is worked from the terminal', width))
  ];
  const room = Math.max(0, height - head.length - body.length - attention.length - detail.length - foot.length - 2);
  const activity =
    room === 0
      ? []
      : [
          '',
          chalk.bold('ACTIVITY'),
          ...feed
            .slice(0, room)
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
