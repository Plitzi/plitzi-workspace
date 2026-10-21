import type { TaskStatus } from './model';

/**
 * What a task is being worked in, its agent on it: at work, or sent back to it — what counts toward the agents at work,
 * owes a sign of life, and holds an agent that asks the lead. A spike is no agent's: a lead finds it out (`spikedBy`).
 */
const WORKED = ['in-progress', 'changes-requested'] as const;

export type WorkedStatus = (typeof WORKED)[number];

export const isWorked = (status: TaskStatus): status is WorkedStatus => WORKED.some(worked => worked === status);
