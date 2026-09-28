import { defineAction } from '@plitzi/sdk-authoring';

import type { ActionTriggerSpec } from '@plitzi/sdk-authoring';
import type { ActionLookups } from '@plitzi/sdk-server/actions';
import type { ActionEntry, ActionField } from '@plitzi/sdk-shared';

/**
 * Every action this space has, as documents.
 *
 * Three kinds, and the difference between them is only their trigger step:
 *
 * - **Scheduled** — a `schedule` trigger with a cron. The server derives a schedule ROW from each one at boot, and
 *   from then on the sweep reads a due time, not these documents.
 * - **Queued** — a `custom` trigger named {@link QUEUE_TRIGGER}. Nothing calls them directly: a job does, once it
 *   is due, on whichever replica claims it. That is how "in five seconds" works — a job with a due time.
 * - **Called** — a `call` trigger, pressed from the page. The ones that start work put a job on the queue and
 *   answer at once; the operator ones act on a job that is already there.
 */

/** The name the queued actions' `custom` trigger is mounted under. A job may only be enqueued for an action that
 *  declares it — see `example.enqueue`. */
export const QUEUE_TRIGGER = 'queue';

// ── Scheduled ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Every minute, on the minute: the one to watch. Stop the server for three minutes and start it again — it runs
 *  ONCE and the board says it missed two, rather than replaying them in a burst. */
const heartbeat = defineAction({
  id: 'heartbeat',
  name: 'Minute heartbeat',
  description: 'Fires on every minute boundary.',
  // A clock has no caller, so a schedule states no access rule and takes no input.
  trigger: { type: 'schedule', cron: '* * * * *' },
  steps: [{ id: 'note', task: 'example.note', params: { message: 'The minute cron fired' } }]
});

/**
 * Nine in the morning in Madrid, on weekdays — whatever zone the server runs in.
 *
 * The zone belongs to the document, not to the machine: the next fire is computed against Madrid's wall clock, so
 * it stays at 09:00 across the change to summer time instead of drifting an hour, and a replica in another country
 * produces the same fire.
 */
const weekdayDigest = defineAction({
  id: 'weekday-digest',
  name: 'Weekday digest',
  description: 'Sends the morning digest on working days.',
  trigger: { type: 'schedule', cron: '0 9 * * 1-5', timezone: 'Europe/Madrid' },
  steps: [{ id: 'note', task: 'example.note', params: { message: 'The weekday digest went out' } }]
});

/** Switched off, and still on the board: a missing row could not tell an operator that this space HAS an hourly
 *  report and that somebody turned it off. */
const hourlyReport = defineAction({
  id: 'hourly-report',
  name: 'Hourly report',
  description: 'Paused while the report is being redesigned.',
  trigger: { type: 'schedule', cron: '0 * * * *', enabled: false },
  steps: [{ id: 'note', task: 'example.note', params: { message: 'The hourly report ran' } }]
});

// ── Queued ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** `access: 'public'` says only that there is no visitor to authorize: a job is not a session. What may put a job
 *  on the queue is decided upstream — by `example.enqueue` and the action that calls it. */
const queued = (input: Record<string, ActionField>): ActionTriggerSpec => ({
  type: 'custom',
  name: QUEUE_TRIGGER,
  access: 'public',
  input
});

const reminder = defineAction({
  id: 'reminder',
  name: 'Reminder',
  description: 'Writes a reminder to the activity feed when it comes due.',
  trigger: queued({ message: { type: 'text', required: true, label: 'Message' } }),
  steps: [{ id: 'note', task: 'example.note', params: { message: 'Reminder: {{input.message}}' } }]
});

/**
 * Fails its first `failures` attempts, then goes through — an upstream that is down for a while.
 *
 * `jobId` is the job's own id, which `example.enqueue` hands every job it creates. It is what the task counts
 * attempts against: a run id changes with every attempt, and the count has to survive them.
 */
const flakySync = defineAction({
  id: 'flaky-sync',
  name: 'Flaky sync',
  description: 'Refused by its upstream a set number of times before it succeeds.',
  trigger: queued({
    jobId: { type: 'text', required: true, label: 'Job id' },
    failures: { type: 'number', defaultValue: 2, label: 'Attempts to refuse' }
  }),
  steps: [{ id: 'sync', task: 'example.flaky' }]
});

/** Long enough to cancel from the page — or to kill the replica running it and watch another one take it over. */
const slowExport = defineAction({
  id: 'slow-export',
  name: 'Slow export',
  description: 'Works for a number of seconds, stopping promptly when cancelled.',
  trigger: queued({ seconds: { type: 'number', defaultValue: 20, label: 'Seconds of work' } }),
  steps: [{ id: 'export', task: 'example.work' }]
});

// ── Called from the page ───────────────────────────────────────────────────────────────────────────────────────

/**
 * A button that queues a job and answers at once.
 *
 * The page never waits for the work: it gets the job's id and a sentence back, and the board shows the job move
 * through the queue from there. `payload: '{{input}}'` is a lone token, so it arrives as the whole validated input
 * object rather than as text — whatever the caller sent that this trigger did not declare is already gone.
 *
 * No `output`: the answer is the enqueue step's whole result, which is exactly `{ jobId, dueAt, summary }`.
 */
const queueing = (spec: {
  id: string;
  name: string;
  job: string;
  input: Record<string, ActionField>;
  delaySeconds?: string;
}): ActionEntry =>
  defineAction({
    id: spec.id,
    name: spec.name,
    description: `Queues a "${spec.job}" job.`,
    // Public because this example has no sign-in. On a real site this is `{ mode: 'role', permissions: [...] }`.
    trigger: { type: 'call', access: 'public', input: spec.input },
    steps: [
      {
        id: 'queued',
        task: 'example.enqueue',
        params: { actionId: spec.job, delaySeconds: spec.delaySeconds ?? '0', payload: '{{input}}' }
      }
    ]
  });

const remindMe = queueing({
  id: 'remind-me',
  name: 'Remind me later',
  job: 'reminder',
  input: {
    message: { type: 'text', required: true, defaultValue: 'Stand up and stretch', label: 'Message' },
    seconds: { type: 'number', defaultValue: 5, label: 'In how many seconds' }
  },
  delaySeconds: '{{input.seconds}}'
});

const startFlaky = queueing({
  id: 'start-flaky',
  name: 'Start a flaky sync',
  job: 'flaky-sync',
  input: { failures: { type: 'number', defaultValue: 2, label: 'Attempts to refuse' } }
});

const startExport = queueing({
  id: 'start-export',
  name: 'Start a slow export',
  job: 'slow-export',
  input: { seconds: { type: 'number', defaultValue: 20, label: 'Seconds of work' } }
});

/**
 * The operator's two buttons. Both answer for this space's jobs only — the task passes its own space id to the
 * queue, which refuses a job that belongs to another.
 *
 * Public here for the same reason as above. These are the ones that must never be public on a real site: running a
 * job again sends the email again.
 */
const jobControl = (id: string, name: string, task: string): ActionEntry =>
  defineAction({
    id,
    name,
    trigger: { type: 'call', access: 'public', input: { jobId: { type: 'text', required: true, label: 'Job id' } } },
    steps: [{ id: 'done', task }]
  });

const retryJob = jobControl('job-retry', 'Run a job again', 'example.retry');
const cancelJob = jobControl('job-cancel', 'Cancel a job', 'example.cancel');

/**
 * What the page shows: a `render` trigger, so the board arrives in the HTML and every refresh the page asks for
 * afterwards is the same action run again. No `cacheSeconds` — the whole point of the board is that it moves.
 */
const board = defineAction({
  id: 'queue-board',
  name: 'Queue board',
  description: 'Schedules, jobs and activity, formatted for the page.',
  trigger: { type: 'render', access: 'public' },
  steps: [{ id: 'board', task: 'example.board' }]
});

const actions: ActionEntry[] = [
  heartbeat,
  weekdayDigest,
  hourlyReport,
  reminder,
  flakySync,
  slowExport,
  remindMe,
  startFlaky,
  startExport,
  retryJob,
  cancelJob,
  board
];

/** The one space this server serves. A multi-tenant deployment keys every lookup below by it. */
export const SPACE_ID = 1;

/** Whether a document can be started by a job this deployment enqueued. */
export const acceptsQueuedJobs = (entry: ActionEntry): boolean =>
  Object.values(entry.document.nodes).some(
    node => node.type === 'trigger' && node.action === 'custom' && node.enabled && node.params.name === QUEUE_TRIGGER
  );

/**
 * How the server reaches the documents.
 *
 * `listActions` is the half that turns scheduling on: with it the server can ask what a space has scheduled, and
 * without it there is no way to know, so no scheduler is built at all. A real deployment reads rows here.
 */
export const lookups: ActionLookups = {
  getAction: (spaceId, actionId) =>
    Promise.resolve(spaceId === SPACE_ID ? actions.find(entry => entry.id === actionId) : undefined),
  listActions: spaceId => Promise.resolve(spaceId === SPACE_ID ? actions : [])
};
