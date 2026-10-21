import chalk from 'chalk';

import { ago, cell, hhmm, idCell, wrapped } from './monitorCells';
import { designSkipText } from '../../runs/designSkip';

import type { AgentLine, AgentStatus, Monitored, TaskStory } from '../../runs/monitor';
import type { TaskLine } from '../../runs/view';

/**
 * The monitor's board under the flow: each task's row and its story, each agent's row, and the two side by side — or
 * one under the other on a narrow terminal.
 */

export const TASK_STATE: Record<TaskLine['status'], (task: TaskLine) => string> = {
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

export const AGENT_STATE: Record<AgentStatus, string> = {
  working: chalk.cyan('● working'),
  reviewing: chalk.magenta('● reviewing'),
  blocked: chalk.yellow('● blocked'),
  asking: chalk.yellow('? asks the lead'),
  waiting: chalk.cyan('◌ waiting'),
  idle: chalk.dim('○ idle'),
  stopped: chalk.dim('◼ stopped'),
  done: chalk.green('✓ done'),
  'not-started': chalk.dim('· not started'),
  'no-signal': chalk.red('● no signal')
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
          ? [`  ${designSkipText(story.designSkip)}`]
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

export const detailOf = (task: TaskLine, story: TaskStory | undefined): string[] => [
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

/** What the agents' brief keeps at the end of its last line, cut short: ` · + 12 more`. */
const BRIEF_MORE = 13;
/** The most tasks listed at once: the rest scrolled to with ↑↓, their rows the activity's. */
export const TASK_ROWS = 15;
/** Under it the agents go under the tasks rather than beside them: each column would be too narrow to read. */
const BESIDE_WIDTH = 140;

/**
 * The tasks and the agents in `rows`: side by side on a wide terminal, the agents under the tasks on a narrow one — the
 * tasks scrolled to keep the one selected in view. Which of its lines are the tasks', for the wheel.
 */
export const bodyOf = ({
  tasks,
  listed,
  agents,
  stories,
  selected,
  open,
  showApproved,
  width,
  rows,
  now
}: {
  tasks: readonly TaskLine[];
  listed: readonly TaskLine[];
  agents: readonly AgentLine[];
  stories: Monitored['stories'];
  selected: number;
  open: boolean;
  showApproved: boolean;
  width: number;
  rows: number;
  now: Date;
}): { lines: string[]; tasks: [number, number] } => {
  const beside = width >= BESIDE_WIDTH;
  // Stacked, the agents are said in brief — each its name and state, as many to a line as fit — in a third of the rows
  // at most; beside the tasks, each has its row with what it is at.
  const briefItems = [
    chalk.bold(`AGENTS (${String(agents.length)})`),
    ...agents.map(agent => `${chalk.bold(agent.agent)} ${AGENT_STATE[agent.status]}`)
  ];
  const whole = wrapped(briefItems, width);
  const agentRows = beside ? rows : Math.min(whole.length, Math.max(1, Math.floor(rows / 3)));
  // Cut short, wrapped narrower: its last line keeps room to count those it leaves out.
  const brief = whole.length > agentRows ? wrapped(briefItems, width - BRIEF_MORE) : whole;
  const approved = tasks.filter(task => task.status === 'done').length;
  const folded = listed.length < tasks.length;
  const taskRoom = Math.min(TASK_ROWS, Math.max(1, (beside ? rows : rows - agentRows) - 1 - (folded ? 1 : 0)));
  const first = Math.min(Math.max(0, selected - Math.floor(taskRoom / 2)), Math.max(0, listed.length - taskRoom));
  const shown = listed.slice(first, first + taskRoom);
  const below = listed.length - first - shown.length;
  const taskLines = [
    chalk.bold(
      `TASKS (${String(tasks.length)})${listed.length > taskRoom ? chalk.dim(` ${String(first + 1)}–${String(first + shown.length)}`) : ''}`
    ) +
      chalk.dim(
        `  ↑↓ choose · enter ${open ? 'closes' : 'opens'} it${tasks.some(task => task.status !== 'done') ? ` · a ${showApproved ? 'hides' : 'shows'} the approved` : ''}${below > 0 ? ` · ↓ ${String(below)} more` : ''}`
      ),
    ...shown.map((task, index) => taskRow(task, stories[task.id], first + index === selected, now)),
    ...(folded
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
  ];
  if (!beside) {
    // What the brief has no room for is counted on its last line, never cut off unsaid.
    const kept = brief.slice(0, agentRows);
    const unsaid = agents.filter(agent => !kept.some(line => line.includes(agent.agent))).length;

    return {
      lines: [
        ...taskLines.map(line => cell(line, width)),
        ...kept.map((line, index) =>
          index === kept.length - 1 && unsaid > 0
            ? cell(`${line.trimEnd()}${chalk.dim(` · + ${String(unsaid)} more`)}`, width)
            : line
        )
      ],
      tasks: [1, 1 + shown.length]
    };
  }

  // Those that fit, and a line saying how many did not — its own row kept for it.
  const fitting = agents.length <= rows - 1 ? agents : agents.slice(0, Math.max(0, rows - 2));
  const agentLines = [
    chalk.bold(`AGENTS (${String(agents.length)})`),
    ...fitting.map(agent => agentRow(agent, now)),
    ...(fitting.length < agents.length ? [chalk.dim(`  + ${String(agents.length - fitting.length)} more`)] : [])
  ];
  const leftWidth = Math.max(30, Math.floor(width * 0.42));

  return {
    lines: columns(taskLines, agentLines, leftWidth, Math.max(10, width - leftWidth - 3)),
    tasks: [1, 1 + shown.length]
  };
};
