import type { ActionJobStatus } from '../types/ActionTypes';

/** Every status a job of the queue can be in — what a filter of the Queue accepts, read from one list. */
export const ACTION_JOB_STATUSES = [
  'pending',
  'running',
  'paused',
  'succeeded',
  'failed',
  'dead',
  'cancelled'
] as const satisfies readonly ActionJobStatus[];

/** The statuses a job ends in: kept readable for a while, and what an operator may run again. */
export const TERMINAL_JOB_STATUSES = [
  'succeeded',
  'failed',
  'dead',
  'cancelled'
] as const satisfies readonly ActionJobStatus[];

export const isActionJobStatus = (value: unknown): value is ActionJobStatus =>
  ACTION_JOB_STATUSES.some(status => status === value);

export const isTerminalJobStatus = (status: ActionJobStatus): boolean =>
  TERMINAL_JOB_STATUSES.some(terminal => terminal === status);
