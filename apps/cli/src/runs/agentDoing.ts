import type { AgentStatus } from './monitor';
import type { TaskLine } from './view';

/** What an agent holding `task` is, and does, in its row's words: the board's and the dev tools' one reading. */

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
      return `reviews the UI of ${task.id}`;
    case 'changes-requested':
      return `redoes ${task.id} (round ${String(task.round)})`;
    case 'waiting':
      return `${task.id} waits for ${task.waitingFor?.task ?? 'another task'}`;
    case 'blocked':
      return `${task.id} blocked`;
    default:
      return `writes ${task.id}${task.step ? ` — ${task.step}` : ''}`;
  }
};
