import type { AgentStatus } from './monitor';
import type { TaskLine } from './view';
import type { CommandPath } from '../../commandPath';

/** What an agent holding `task` is, and does, in its row's words: the board's and the dev tools' one reading. */

/** What each command is about, in a person's words — its path or task where it names one. */
const DOING: Record<string, (target: string | undefined, flags: ReadonlySet<string>) => string> = {
  'page measure': (target, flags) =>
    `measuring ${target ?? 'a page'}${flags.has('--compare') ? ' against the original' : ''}`,
  'page shot': (target, flags) =>
    `picturing ${target ?? 'a page'}${flags.has('--compare') ? ' beside the original' : ''}`,
  'page check': target => `checking ${target ?? 'a page'} in a browser`,
  'task check': () => 'running its checks',
  'task prove': (target, flags) =>
    `proving ${target ?? 'its task'}'s acceptance ${flags.has('--before') ? 'beside the run before it' : 'on a mutant'}`,
  'task context': () => 'reading its brief',
  'task show': target => `reading ${target ?? 'a task'}'s changes`,
  'task look': target => `looking at ${target ?? 'a task'}`,
  'task complete': () => 'sending its work to review',
  'task review': target => `saying its verdict on ${target ?? 'a task'}`,
  'task next': () => 'asking for work',
  'task claim': (target, flags) =>
    target === undefined
      ? 'reading who holds which file'
      : flags.has('--wait')
        ? 'waiting for a shared file'
        : flags.has('--release')
          ? 'letting a shared file go'
          : 'taking a shared file',
  'task propose': (target, flags) =>
    flags.has('--file')
      ? 'asking for a change in a shared file'
      : target === undefined
        ? 'reading the proposals'
        : `proposing a change to ${target}`,
  'task message': () => 'writing to the run',
  'task tell': (_target, flags) =>
    flags.has('--ask')
      ? 'asking the lead'
      : flags.has('--blocked')
        ? 'saying what stops its task'
        : flags.has('--handoff')
          ? 'leaving a note for the next'
          : flags.has('--standing')
            ? 'saying where it stands'
            : 'telling the lead'
};

/**
 * What an agent's last command was about, in words — `plitzi page measure /cart … --compare <site>` is "measuring /cart
 * against the original": what it is at between the CLI's own marks of its task, where its row said "writes t-x" alone.
 */
export const commandDoing = ({ name, options, args }: CommandPath): string => {
  const said = Object.hasOwn(DOING, name) ? DOING[name] : undefined;

  return said ? said(args.at(0), new Set(options)) : `running ${name || 'a command'}`;
};

export const statusOf = (task: TaskLine): AgentStatus =>
  task.asking && !task.asking.answered
    ? 'asking'
    : task.noSignal
      ? 'no-signal'
      : // Held at review only by the designer at its UI review (`assignee`): what it is at.
        task.status === 'in-review'
        ? 'reviewing'
        : task.status === 'blocked' || task.status === 'waiting'
          ? 'blocked'
          : 'working';

export const doingOf = (task: TaskLine): string => {
  if (task.asking) {
    return task.asking.answered
      ? `${task.id}: the lead answered ${task.asking.id} — its next command takes it up`
      : `${task.id} waits for the lead's answer to ${task.asking.id}: ${task.asking.text}`;
  }

  switch (task.status) {
    case 'in-review':
      return `reviews ${task.id}${task.step ? ` — ${task.step}` : task.review ? ` — its ${task.review.role}'s step` : ''}`;
    case 'changes-requested':
      return `redoes ${task.id} (round ${String(task.round)})`;
    case 'waiting':
      return `${task.id} waits for ${task.waitingFor?.task ?? 'another task'}`;
    case 'blocked':
      return `${task.id} blocked`;
    default:
      return `${task.spike !== undefined ? 'finds out' : 'writes'} ${task.id}${task.step ? ` — ${task.step}` : ''}`;
  }
};
