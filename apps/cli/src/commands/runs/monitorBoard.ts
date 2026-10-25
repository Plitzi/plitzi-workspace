import { waitsText } from './monitorFlow';
import { hhmm } from './monitorModel';
import { designSkipText } from '../../runs/designSkip';

import type { Tone } from './monitorModel';
import type { TaskStory } from '../../runs/monitor';
import type { TaskLine } from '../../runs/view';

/**
 * What the panel says of each task: in what order the lists show them, where each stands in a few words, its time
 * against its estimate and its story — plain words, each part of the screen drawing them in its own tones.
 */

/** Where a task stands, the work first: at work, sent back, in review, waiting — then free, pending, and done last. */
const ORDER: Record<TaskLine['status'], number> = {
  'in-progress': 0,
  spike: 1,
  'changes-requested': 2,
  'in-review': 3,
  waiting: 4,
  blocked: 5,
  failed: 6,
  ready: 7,
  pending: 8,
  done: 9
};

/** The tasks as the panel lists them: by where each stands, the plan's order within — the latest approval first. */
export const orderedTasks = (tasks: readonly TaskLine[]): TaskLine[] =>
  tasks
    .map((task, index) => ({ task, index }))
    .sort(
      (a, b) =>
        ORDER[a.task.status] - ORDER[b.task.status] ||
        (a.task.status === 'done' ? b.task.updatedAt.localeCompare(a.task.updatedAt) : 0) ||
        a.index - b.index
    )
    .map(({ task }) => task);

/** The tasks a list shows: all of them, or — the default — those not approved yet, the approved said in a line. */
export const listedTasks = (tasks: readonly TaskLine[], showApproved: boolean): TaskLine[] => {
  const ordered = orderedTasks(tasks);
  const left = ordered.filter(task => task.status !== 'done');

  // Nothing left: the approved are all there is to see — listed, never folded into a count.
  return showApproved || left.length === 0 ? ordered : left;
};

const minutesBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 60_000);

/** A task's minutes: spent while it is worked, from its first take to its approval once done. */
export const spentOf = (task: TaskLine, story: TaskStory | undefined): number | undefined =>
  task.status === 'done' && story?.takenAt && story.approvedAt
    ? minutesBetween(story.takenAt, story.approvedAt)
    : task.spentMinutes;

/** Its time against its estimate: `4m / 20m`. */
export const timeOf = (task: TaskLine, story: TaskStory | undefined): string => {
  const spent = spentOf(task, story);

  return spent === undefined ? '' : `${String(spent)}m / ${String(task.estimateMinutes)}m`;
};

/**
 * Who a task is with, or what it is waiting on, in a few words: its agent, its reviewer, what it follows — what a row
 * of the list says beside its id. A pending task names the tasks it follows and where each stands: its tasks at review
 * were a pending task's whole reason, and nothing on the screen said so.
 */
export const withText = (task: TaskLine, tasks: readonly TaskLine[], story: TaskStory | undefined): string => {
  switch (task.status) {
    case 'pending':
      return waitsText(task, tasks) || 'pending';
    case 'ready':
      return 'free to take';
    case 'spike':
      return task.spikedBy ? `${task.spikedBy} finds out` : 'for a lead';
    case 'in-progress':
      return task.asking
        ? task.asking.answered
          ? `${task.agent ?? ''} has its answer (${task.asking.id})`
          : `${task.agent ?? ''} asks the lead (${task.asking.id})`
        : task.parkedFor
          ? `${task.agent ?? ''} at ${task.parkedFor} first`
          : `${task.agent ?? ''}${task.fraction === undefined ? '' : ` ${String(Math.round(task.fraction * 100))}%`}`;
    case 'changes-requested':
      return task.parkedFor
        ? `${task.agent ?? ''} at ${task.parkedFor} first · round ${String(task.round)}`
        : `${task.agent ?? ''} · round ${String(task.round)}`;
    case 'in-review':
      return task.design?.status === 'due' && task.reviewer === undefined
        ? `UI review · ${task.design.by ?? 'no designer yet'}`
        : `review · ${task.reviewer ?? 'no lead yet'}`;
    case 'waiting':
      return `waits ${task.waitingFor?.task ?? 'a file'}`;
    case 'blocked':
      return `needs ${task.blockedBy?.needs ?? 'someone'}`;
    case 'failed':
      return 'failed';
    case 'done':
      return story?.writers.join(', ') ?? '';
  }
};

/** The tone of what a row says beside its id: a question or a hold in the warning's, the rest as its state. */
export const withTone = (task: TaskLine): Tone =>
  task.asking && !task.asking.answered ? 'warning' : task.status === 'pending' ? 'subtle' : 'muted';

/** What the task dialog says of a task, a line each: who wrote it, its UI's review, its approval, what holds it. */
export const storyLines = (task: TaskLine, story: TaskStory | undefined): { text: string; tone: Tone }[] => [
  ...(story && story.writers.length > 0
    ? [
        {
          text: `written by ${story.writers.join(', then ')}${story.takenAt ? ` from ${hhmm(story.takenAt)} UTC` : ''}`,
          tone: 'muted' as const
        }
      ]
    : []),
  ...(story?.design === 'skipped'
    ? [{ text: designSkipText(story.designSkip), tone: 'muted' as const }]
    : story?.design
      ? [{ text: `its UI approved by ${story.design}`, tone: 'muted' as const }]
      : []),
  ...(story?.approvedAt
    ? [
        {
          text: `approved by ${story.approvedBy ?? 'lead'} at ${hhmm(story.approvedAt)} UTC${timeOf(task, story) ? ` — ${timeOf(task, story)}` : ''}`,
          tone: 'success' as const
        }
      ]
    : []),
  ...(story && (story.sentBack > 0 || story.failedChecks > 0)
    ? [
        {
          text: [
            story.sentBack > 0 ? `sent back ${String(story.sentBack)}×` : '',
            story.failedChecks > 0
              ? `${String(story.failedChecks)} failed check${story.failedChecks === 1 ? '' : 's'}`
              : ''
          ]
            .filter(Boolean)
            .join(' · '),
          tone: 'warning' as const
        }
      ]
    : []),
  ...(task.asking
    ? [
        {
          text: task.asking.answered
            ? `the lead answered ${task.asking.id} — ${task.agent ?? 'its agent'} has it with its next command`
            : `asks the lead (${task.asking.id}): ${task.asking.text}`,
          tone: 'warning' as const
        }
      ]
    : []),
  ...(task.step ? [{ text: `now: ${task.step}`, tone: 'text' as const }] : []),
  ...(task.waitsOn
    ? [
        {
          text: `starts once ${task.waitsOn.join(', ')} ${task.waitsOn.length === 1 ? 'is' : 'are'} approved`,
          tone: 'muted' as const
        }
      ]
    : []),
  ...(task.waitingFor
    ? [
        {
          text: `waits for ${task.waitingFor.task}${task.waitingFor.file ? `: ${task.waitingFor.file}` : ''}`,
          tone: 'warning' as const
        }
      ]
    : []),
  ...(task.blockedBy ? [{ text: `blocked: ${task.blockedBy.reason}`, tone: 'danger' as const }] : []),
  ...(task.unblocks.length > 0 ? [{ text: `then: ${task.unblocks.join(', ')}`, tone: 'muted' as const }] : [])
];
