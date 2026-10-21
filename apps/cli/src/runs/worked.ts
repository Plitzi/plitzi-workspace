import type { TaskStatus } from './model';

/**
 * What a task is being worked in, its agent on it: at work, sent back to it, or finding something out (`spike`) — what
 * counts toward the agents at work, owes a sign of life, and holds an agent that asks the lead.
 */
const WORKED = ['in-progress', 'changes-requested', 'spike'] as const;

export type WorkedStatus = (typeof WORKED)[number];

export const isWorked = (status: TaskStatus): status is WorkedStatus => WORKED.some(worked => worked === status);
