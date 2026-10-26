import type { Tone } from './monitorModel';
import type { TaskLine } from '../../runs/view';

/**
 * The run as a flow, from to-do to approved — the board's kanban: each stage, the tasks standing in it and who each is
 * with. What the monitor draws in brief under its activity and whole as its Flow view.
 */
export interface FlowStage {
  key: string;
  title: string;
  glyph: string;
  tone: Tone;
  tasks: TaskLine[];
  /** Who a card is with, or what it waits on: its agent, the lead at its spike, its reviewer. */
  who: (task: TaskLine) => string;
}

/**
 * A task as its card names it: a task sent back by a review is at work again with the agent that wrote it, marked by
 * the round it is at — `t-boxer ↺2` — rather than in a stage of its own: it goes round the same steps again.
 */
export const nameOf = (task: TaskLine): string =>
  task.status === 'changes-requested' ? `${task.id} ↺${String(task.round)}` : task.id;

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
export const flowStages = (tasks: readonly TaskLine[]): FlowStage[] => {
  const of = (status: TaskLine['status']) =>
    tasks.filter(task => task.status === status).sort((a, b) => Number(withSomeone(b)) - Number(withSomeone(a)));

  return [
    // Only whom it waits for: where each of them stands is the column it is in.
    {
      key: 'pending',
      title: 'Pending',
      glyph: '○',
      tone: 'subtle' as const,
      tasks: of('pending'),
      who: (task: TaskLine) => {
        const left = waitedFor(task, tasks).map(other => other.id);

        return left.length > 0 ? `after ${left.join(', ')}` : '';
      }
    },
    // Finding something out before it is built: whoever is on it — research waits for nothing. A run that researched
    // nothing has no column for it.
    ...(tasks.some(task => task.status === 'spike' || task.found !== undefined)
      ? [
          {
            key: 'spike',
            title: 'Spike',
            glyph: '◇',
            tone: 'info' as const,
            tasks: of('spike'),
            // Never "free": no agent takes a spike — the lead at it, or one is waited for.
            who: (task: TaskLine) => task.spikedBy ?? 'for a lead'
          }
        ]
      : []),
    // Free to take: no agent's yet — a task sent back is its writer's, at work or held.
    { key: 'ready', title: 'Ready', glyph: '○', tone: 'muted' as const, tasks: of('ready'), who: () => '' },
    // One card an agent: the task it is at — written, or again after a review sent it back (↺). The others it holds
    // wait for it, held (dev-2 "ready" with t-home and "at work" with t-overlay at once).
    {
      key: 'work',
      title: 'At work',
      glyph: '◐',
      tone: 'info' as const,
      tasks: [...of('in-progress'), ...of('changes-requested')].filter(task => !task.asking && !task.parkedFor),
      who: (task: TaskLine) => task.agent ?? ''
    },
    // What holds an agent back: a block, a file another task has, a question to the lead, its agent at another task,
    // a failure.
    {
      key: 'held',
      title: 'Held',
      glyph: '■',
      tone: 'warning' as const,
      tasks: [
        ...of('blocked'),
        ...of('waiting'),
        ...tasks.filter(task => task.asking),
        ...tasks.filter(task => task.parkedFor),
        ...of('failed')
      ],
      who: (task: TaskLine) =>
        task.asking
          ? task.asking.answered
            ? `answered (${task.asking.id})`
            : `asks lead (${task.asking.id})`
          : task.parkedFor
            ? `${task.agent ?? ''} at ${task.parkedFor}`
            : task.status === 'blocked'
              ? `needs ${task.blockedBy?.needs ?? 'someone'}`
              : task.status === 'waiting'
                ? `waits ${task.waitingFor?.task ?? 'a file'}`
                : 'failed'
    },
    {
      key: 'ui-review',
      title: 'UI review',
      glyph: '◎',
      tone: 'link' as const,
      tasks: of('in-review').filter(task => task.design?.status === 'due' && task.reviewer === undefined),
      who: (task: TaskLine) => task.design?.by ?? 'waiting'
    },
    {
      // A lead that took a review whose UI waits for a designer reviews it whole (--skip-design reviewer): it is with the
      // lead, named — never "nobody yet" in the UI's column while the lead says it is reviewing it.
      key: 'lead-review',
      title: 'Lead review',
      glyph: '◎',
      tone: 'link' as const,
      tasks: of('in-review').filter(task => task.design?.status !== 'due' || task.reviewer !== undefined),
      who: (task: TaskLine) => task.reviewer ?? 'waiting'
    },
    // The latest approval first: what just landed is what a person following the run looks for.
    {
      key: 'approved',
      title: 'Approved',
      glyph: '✓',
      tone: 'success' as const,
      tasks: of('done').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      who: (task: TaskLine) => task.agent ?? ''
    }
  ];
};

/**
 * The flow in brief, as the activity's foot shows it: both reviews one column — the whole board (view 2) splits them —
 * so every stage is wide enough to read on any terminal.
 */
export const briefStages = (tasks: readonly TaskLine[]): FlowStage[] =>
  flowStages(tasks).reduce<FlowStage[]>((stages, stage) => {
    const before = stages.at(-1);
    if (stage.key === 'lead-review' && before?.key === 'ui-review') {
      stages[stages.length - 1] = {
        ...stage,
        key: 'review',
        title: 'Review',
        tasks: [...before.tasks, ...stage.tasks]
      };

      return stages;
    }

    return [...stages, stage];
  }, []);
