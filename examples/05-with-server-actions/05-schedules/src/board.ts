import type { ActivityEntry } from './store/activity';
import type { ActionEntry, ActionJob, ActionJobStatus, ActionSchedule } from '@plitzi/sdk-shared';

/**
 * The queue, shaped for a page that can only bind.
 *
 * A binding shows a field or hides an element on a truthy one; it cannot compare two values or format a date. So
 * every sentence the board prints is written here, once, on the server — and every decision the page makes is a
 * boolean: `canRetry`, `canCancel`, `hasError`. The page stays a layout.
 */

const TERMINAL: ActionJobStatus[] = ['succeeded', 'failed', 'dead', 'cancelled'];

/**
 * Every instant the server prints is UTC, and says so.
 *
 * The replicas of one deployment can sit in different countries, and a board that printed each one's local time
 * would show the same job at two different hours depending on which replica served the page. UTC is the one
 * reading they all agree on — the cron expressions without a zone are evaluated in it too.
 */
const utc = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC'
});

const time = (ms: number): string => `${utc.format(ms)} UTC`;

/**
 * A schedule's next fire: the UTC instant, and — for a schedule written in a zone — the wall-clock time it was
 * written as, because "07:00 UTC" does not say that the digest goes out at nine in Madrid. More than a day out it
 * gets its date too.
 */
const fireTime = (ms: number, soon: boolean, timeZone?: string): string => {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-GB', {
      ...(soon ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: zone
    }).format(ms);

  return timeZone ? `${format('UTC')} UTC (${format(timeZone)} ${timeZone})` : `${format('UTC')} UTC`;
};

const span = (ms: number): string => {
  const seconds = Math.round(Math.abs(ms) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }

  return seconds < 86_400 ? `${Math.round(seconds / 3600)}h` : `${Math.round(seconds / 86_400)}d`;
};

const relative = (deltaMs: number): string => (deltaMs >= 0 ? `in ${span(deltaMs)}` : `${span(deltaMs)} ago`);

const STATUS_LABEL: Record<ActionJobStatus, string> = {
  pending: 'Waiting',
  running: 'Running',
  succeeded: 'Done',
  failed: 'Failed',
  dead: 'Gave up',
  cancelled: 'Cancelled'
};

const statusLabel = (job: ActionJob): string => {
  if (job.status === 'running' && job.cancelRequested) {
    return 'Stopping';
  }

  // Back in the queue after a failed attempt: waiting, but not for the first time.
  return job.status === 'pending' && job.history.length > 0 ? 'Retrying' : STATUS_LABEL[job.status];
};

const detail = (job: ActionJob, at: number): string => {
  if (job.status === 'pending') {
    return job.runAt > at ? `due ${time(job.runAt)} · ${relative(job.runAt - at)}` : 'due now · waiting for a worker';
  }

  if (job.status === 'running') {
    return `on ${job.workerId ?? 'a worker'} · started ${relative(job.updatedAt - at)}`;
  }

  return `${time(job.updatedAt)} · ${relative(job.updatedAt - at)}`;
};

export type BoardJob = {
  id: string;
  name: string;
  status: ActionJobStatus;
  statusLabel: string;
  source: string;
  attempts: string;
  detail: string;
  history: string;
  hasHistory: boolean;
  error: string;
  hasError: boolean;
  canRetry: boolean;
  canCancel: boolean;
};

const boardJob = (job: ActionJob, names: Map<string, string>, at: number): BoardJob => {
  const missed = job.missed ? ` · ${job.missed} missed before it` : '';

  return {
    id: job.id,
    name: names.get(job.actionId) ?? job.actionId,
    status: job.status,
    statusLabel: statusLabel(job),
    source: `${job.trigger === 'schedule' ? 'scheduled' : 'queued'}${missed}`,
    attempts: `attempt ${job.attempts} of ${job.maxAttempts}`,
    detail: detail(job, at),
    // `lost` is the attempt nobody reported — a replica that died holding it — and the one worth seeing here.
    history: job.history.map(attempt => `#${attempt.attempt} ${attempt.status} on ${attempt.workerId}`).join(' · '),
    hasHistory: job.history.length > 0,
    error: job.error ?? '',
    hasError: Boolean(job.error),
    canRetry: TERMINAL.includes(job.status),
    canCancel: !TERMINAL.includes(job.status) && !job.cancelRequested
  };
};

export type BoardSchedule = {
  id: string;
  name: string;
  cron: string;
  zone: string;
  next: string;
  enabled: boolean;
  missed: string;
  hasMissed: boolean;
};

const boardSchedule = (schedule: ActionSchedule, names: Map<string, string>, at: number): BoardSchedule => {
  const soon = schedule.nextRunAt - at < 86_400_000;

  return {
    id: schedule.actionId,
    name: names.get(schedule.actionId) ?? schedule.actionId,
    cron: schedule.cron,
    zone: schedule.timezone ?? 'UTC',
    next: schedule.enabled
      ? `next ${fireTime(schedule.nextRunAt, soon, schedule.timezone)} · ${relative(schedule.nextRunAt - at)}`
      : 'switched off',
    enabled: schedule.enabled,
    missed: `${schedule.missed} missed while nothing was running`,
    hasMissed: schedule.missed > 0
  };
};

export type BoardActivity = { id: number; time: string; replica: string; source: string; message: string };

const boardActivity = (entry: ActivityEntry): BoardActivity => ({
  id: entry.id,
  time: time(entry.at),
  replica: entry.replica,
  source: entry.trigger === 'schedule' ? 'schedule' : 'queue',
  message: entry.message
});

export type BoardInput = {
  at: number;
  replica: string;
  actions: ActionEntry[];
  jobs: ActionJob[];
  schedules: ActionSchedule[];
  activity: ActivityEntry[];
  counts: Record<ActionJobStatus, number>;
};

export const shapeBoard = ({ at, replica, actions, jobs, schedules, activity, counts }: BoardInput) => {
  const names = new Map(actions.map(entry => [entry.id, entry.document.name]));

  return {
    servedBy: `served by ${replica} · ${time(at)}`,
    counts: {
      waiting: counts.pending,
      running: counts.running,
      done: counts.succeeded,
      needsYou: counts.dead + counts.failed,
      cancelled: counts.cancelled
    },
    schedules: schedules.map(schedule => boardSchedule(schedule, names, at)),
    jobs: jobs.map(job => boardJob(job, names, at)),
    hasJobs: jobs.length > 0,
    activity: activity.map(boardActivity),
    hasActivity: activity.length > 0
  };
};
