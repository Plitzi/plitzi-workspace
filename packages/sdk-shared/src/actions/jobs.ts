import type { JobStatus } from '../types/JobTypes';

/** Every status a job of the queue can be in — what a filter of the Queue accepts, read from one list. */
export const JOB_STATUSES = [
  'pending',
  'running',
  'paused',
  'succeeded',
  'failed',
  'dead',
  'cancelled'
] as const satisfies readonly JobStatus[];

/** The statuses a job ends in: kept readable for a while, and what an operator may run again. */
export const TERMINAL_JOB_STATUSES = [
  'succeeded',
  'failed',
  'dead',
  'cancelled'
] as const satisfies readonly JobStatus[];

export const isJobStatus = (value: unknown): value is JobStatus => JOB_STATUSES.some(status => status === value);

export const isTerminalJobStatus = (status: JobStatus): boolean =>
  TERMINAL_JOB_STATUSES.some(terminal => terminal === status);
