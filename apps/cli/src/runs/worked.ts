import type { TaskStatus } from './model';
import type { TaskView } from './taskStore';

/**
 * What a task is being worked in, its agent on it: at work, or sent back to it — what counts toward the agents at work,
 * owes a sign of life, and holds an agent that asks the lead.
 */
const WORKED = ['in-progress', 'changes-requested'] as const;

export type WorkedStatus = (typeof WORKED)[number];

export const isWorked = (status: TaskStatus): status is WorkedStatus => WORKED.some(worked => worked === status);

/** Whether `agent` took a task's work, by the notes its takes leave: nobody reviews its own, nor writes its tests. */
export const workedBy = (view: TaskView, agent: string): boolean =>
  view.state.notes.some(note => note.by === agent && note.text.startsWith('Taken'));
