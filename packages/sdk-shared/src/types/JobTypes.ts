import type { ActionAccess, ActionTriggerType } from './ActionTypes';
import type { Environment } from './CommonTypes';
import type { RunUser, SpaceRevision } from './ServerTypes';

/**
 * The durable queue the server's work waits in: a schedule's fires, the runs set for later, and the jobs of the spaces'
 * functions — one queue, one contract (`JobQueue`), whatever store a deployment keeps it in.
 */

/**
 * Where a job is, as the only durable answer to "did it happen".
 *
 * `pending` is waiting to be taken, `running` is held by a worker under a lease, `paused` is a job of a space's functions
 * set aside with what it saved, until it is resumed — and the other four are terminal, except that an operator may put
 * a `failed`, `dead` or `cancelled` one back to `pending`. `dead` is a job that used up every attempt it was given: it
 * stays, visibly, because the alternative is work that quietly evaporated.
 */
export type JobStatus = 'pending' | 'running' | 'paused' | 'succeeded' | 'failed' | 'dead' | 'cancelled';

/** Why a worker is asked to stop a job it holds: an operator or the code cancelled it, or set it aside. */
export type JobStop = 'cancel' | 'pause';

/** A run of one of the space's actions: a schedule's fire, a run set for later. */
export type ActionJobTarget = {
  kind: 'action';
  /** The action, by its identifier. */
  name: string;
  /** The trigger it is run through — what the action's document lets start it this way. */
  trigger: ActionTriggerType;
};

/**
 * One of the space's functions' jobs (`defineFunctions({ jobs })`), run slice by slice — kept as it was when it started:
 * who started it, who may watch it, and the code it runs.
 */
export type FunctionJobTarget = {
  kind: 'function';
  /** The job, by the name its functions declare it under. */
  name: string;
  /** Who started it: `ctx.user` in every slice, and the one who may always watch it. */
  user?: RunUser;
  /** Who else may watch it (`$job:<id>`): the job's `watch`, as it was declared when it started. */
  watch?: ActionAccess;
  /** The version of the space's code it was started from: every slice runs that code, whatever is published after. */
  at?: SpaceRevision;
};

/** What a job runs: one of the space's actions, or one of its functions' jobs. */
export type JobTarget = ActionJobTarget | FunctionJobTarget;

/** How far a job is, as its code last said (`job.report`). */
export type JobProgress = {
  /** From 0 to 1. */
  fraction: number;
  /** What it is doing, in its own words: `epoch 3 of 10`. */
  step?: string;
  /** Epoch ms, by the queue's clock. */
  at: number;
};

/**
 * One go at a job, kept forever on the job itself.
 *
 * `lost` is the attempt nobody reported: a worker took the job, its lease ran out, and another worker found it
 * abandoned. It is the record of a replica that died mid-run, which is otherwise the one failure that leaves no
 * trace anywhere — and the reason this list exists rather than a single `error` field.
 */
export type JobAttempt = {
  attempt: number;
  status: 'succeeded' | 'failed' | 'cancelled' | 'paused' | 'lost';
  /** Epoch ms, from the QUEUE's clock — never a worker's own. */
  startedAt: number;
  endedAt: number;
  /** Which worker held it, so a bad replica is identifiable from the history alone. */
  workerId: string;
  /** The run this attempt became, when it got far enough to be one. Joins to the run history. */
  runId?: string;
  error?: string;
  /** The error is the code's own refusal (`ActionRefusal`), written for whoever asked — what a job's watcher may read. */
  refused?: true;
};

/** What starting a job needs. Everything else is the queue's to fill in. */
export type JobInput = {
  /**
   * The job's identity, and the whole of its exactly-once guarantee.
   *
   * A schedule derives it from the fire it belongs to — `schedule:<space>:<action>:<instant>` — so two replicas
   * reaching the same fire write the same id and the second one is a no-op. Enqueue is idempotent by this, which
   * is what lets a producer crash between enqueuing and recording that it did.
   */
  id: string;
  spaceId: number;
  environment: Environment;
  /** What it runs — see {@link JobTarget}. */
  target: JobTarget;
  input: Record<string, unknown>;
  /** The instant this job was due, as the schedule stored it. Epoch ms. */
  dueAt: number;
  maxAttempts: number;
  /** Fires that went by unclaimed before this one. Shown to an operator; never acted on. */
  missed?: number;
  /**
   * What a run set to run later (`trigger: 'later'`) was named by: setting it again under the same name replaces the
   * one still waiting, and cancelling it by name drops it.
   */
  key?: string;
};

/** One unit of work the queue is holding, as an operator sees it. */
export type Job = JobInput & {
  status: JobStatus;
  /** Epoch ms before which no worker may take it — a retry's backoff, or the moment it was enqueued. */
  runAt: number;
  attempts: number;
  /** While `running`: the instant the holder's claim lapses and another worker may take it over. */
  leaseUntil?: number;
  workerId?: string;
  runId?: string;
  /** Set by an operator who wants it stopped; the worker holding it reads this and aborts. */
  cancelRequested?: boolean;
  /** Set to set a running job aside: the worker holding it stops it, and it waits as `paused` until resumed. */
  pauseRequested?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Why the last attempt ended badly. */
  error?: string;
  history: JobAttempt[];
  /** What a job of the space's functions last saved (`job.save`): where its next slice starts from. */
  state?: unknown;
  progress?: JobProgress;
  /** What a job of the space's functions answered, once it succeeded. */
  result?: unknown;
  /** How long it has run, every slice together, in ms — what its total duration is held to. */
  activeMs?: number;
};

/**
 * How a worker reports what became of a claim.
 *
 * `delayMs` rather than an instant, and no timestamps: every moment the queue records is read from the QUEUE's
 * clock, because a cluster whose nodes sit in different countries agrees about durations and not about now.
 */
export type JobSettlement = {
  jobId: string;
  workerId: string;
  status: Extract<JobStatus, 'succeeded' | 'failed' | 'dead' | 'cancelled' | 'pending' | 'paused'>;
  /** For a retry: how long from now before it may be claimed again. */
  delayMs?: number;
  runId?: string;
  error?: string;
  /** The attempt to append to the history. Omitted only when the claim is being handed back untouched. */
  attempt?: Omit<JobAttempt, 'attempt' | 'startedAt' | 'endedAt'>;
  /** What a job of the space's functions answered, when it succeeded. */
  result?: unknown;
  /** How long this slice ran, added to the job's `activeMs`. */
  spentMs?: number;
  /**
   * The attempt the claim took is given back: a slice that ended without failing — set aside, cut by its time, or by a
   * replica going away — is not one. Absent, it is given back only for a claim handed back untouched (`pending`, no
   * `attempt`).
   */
  refund?: boolean;
};

/** What a job's code saved while it runs — only by the worker holding it, so a stalled one cannot write over the next. */
export type JobWrite = {
  jobId: string;
  workerId: string;
  state?: unknown;
  progress?: Omit<JobProgress, 'at'>;
};

export type JobQuery = {
  spaceIds: number[];
  status?: JobStatus;
  /** Only runs of actions, or only jobs of the spaces' functions. */
  kind?: JobTarget['kind'];
  /** Only what runs this action, or this job (`target.name`). */
  name?: string;
  limit: number;
  offset: number;
};

/**
 * A recurring intent, as a row rather than as a timer.
 *
 * `nextRunAt` is the point of the whole design: the instant of the next fire is DECIDED ONCE and written down, so
 * every replica afterwards reads the same number instead of asking its own clock whether the moment has come. Two
 * nodes whose clocks differ by a minute then produce the same fires, in the same order, exactly once each — the
 * disagreement moves the WHEN by their skew and can never move the WHETHER.
 */
export type ActionSchedule = {
  spaceId: number;
  actionId: string;
  cron: string;
  timezone?: string;
  environment: Environment;
  enabled: boolean;
  /** Epoch ms of the next fire this schedule owes. The queue's clock decides when that has arrived. */
  nextRunAt: number;
  /** The last fire actually enqueued. */
  lastFireAt?: number;
  /** Fires that went by while nothing was running to take them. Cumulative, and shown to an operator. */
  missed: number;
  maxAttempts: number;
  updatedAt: number;
};

/** A schedule as it is derived from an action document — everything the queue does not own itself. */
export type ActionScheduleInput = Omit<ActionSchedule, 'missed' | 'updatedAt' | 'lastFireAt'>;

/**
 * Where a deployment keeps its jobs and schedules.
 *
 * The same kind of seam as {@link ActionKvAdapter} and for the same reason — the server never learns where a
 * deployment stores anything — but with one rule this one cannot be written without, and it is written here so no
 * deployment has to rediscover it:
 *
 * **Every instant comes from the store.** `now` is the cluster's clock, and every comparison the queue makes
 * internally — is this schedule due, has this lease lapsed, may this retry be claimed — is made against it, never
 * against the caller's. That is why `settle` takes a `delayMs` and not a deadline, and why `claim` takes a
 * `leaseMs` and not a `leaseUntil`: durations survive a cluster spread across time zones and machines whose clocks
 * drift, and absolute instants minted by a caller do not.
 *
 * **`enqueue` is idempotent by `id`,** and answers whether it was the one that created the job. That, and nothing
 * else, is what makes a fire happen exactly once when several replicas are racing to produce it.
 *
 * **`claim` is atomic, and it also reaps.** A job whose lease has lapsed is a job whose worker died, and it is
 * taken by whoever claims next — the same operation, because a separate reaper is a second thing to deploy, to
 * schedule and to forget.
 */
export type JobQueue = {
  /** The cluster's clock. The only clock anything in the scheduling path is allowed to read. */
  now: () => Promise<Date>;
  /** True when this call created the job; false when that id was already there. Never throws on a duplicate. */
  enqueue: (job: JobInput) => Promise<boolean>;
  /**
   * Takes up to `limit` jobs that are due, and any whose lease has lapsed — atomically, one worker per job.
   *
   * A reclaimed job arrives with its previous holder's attempt already written to the history as `lost`.
   */
  claim: (params: { workerId: string; leaseMs: number; limit: number }) => Promise<Job[]>;
  /**
   * Extends the lease on jobs this worker still holds, and answers which of them it is asked to stop — cancelled, or
   * set aside (`pause`).
   */
  heartbeat: (params: {
    jobIds: string[];
    workerId: string;
    leaseMs: number;
  }) => Promise<{ jobId: string; stop: JobStop }[]>;
  settle: (settlement: JobSettlement) => Promise<void>;
  /** Writes what a running job's code saved or reported. False when this worker no longer holds it. */
  write: (write: JobWrite) => Promise<boolean>;
  /** Due schedules, oldest fire first. */
  dueSchedules: (limit: number) => Promise<ActionSchedule[]>;
  /**
   * Moves a schedule forward, but only if it is still where the caller last saw it.
   *
   * The compare-and-set is what stops two replicas from advancing the same schedule twice. Answers false when
   * somebody else got there first, which is not an error — it is the other replica having done the work.
   */
  advanceSchedule: (params: {
    spaceId: number;
    actionId: string;
    from: number;
    to: number;
    missed: number;
  }) => Promise<boolean>;
  /** Replaces what this space has scheduled. An action no longer listed stops having a schedule at all. */
  putSchedules: (params: { spaceId: number; schedules: ActionScheduleInput[] }) => Promise<void>;
  listJobs: (query: JobQuery) => Promise<{ jobs: Job[]; total: number }>;
  getJob: (spaceIds: number[], jobId: string) => Promise<Job | undefined>;
  listSchedules: (spaceIds: number[]) => Promise<ActionSchedule[]>;
  /**
   * Puts a finished job back in the queue — an operator retrying it, or the code starting a keyed job again. Answers false
   * when it is not finished. With `input`, it runs with that; with `fresh`, a job of the space's functions starts over
   * rather than from what it saved.
   */
  requeue: (
    spaceIds: number[],
    jobId: string,
    options?: { input?: Record<string, unknown>; fresh?: boolean }
  ) => Promise<boolean>;
  /** Stops a job: dropped if it is waiting or set aside, aborted at its next step if it is running. */
  cancel: (spaceIds: number[], jobId: string) => Promise<boolean>;
  /**
   * Sets a job of the space's functions aside: one waiting is `paused` at once, one running is flagged for the worker
   * holding it, which stops it once its code has saved. Answers whether it changed anything.
   */
  pause: (spaceIds: number[], jobId: string) => Promise<boolean>;
  /** Puts a `paused` job back in the queue, to start again from what it saved. */
  resume: (spaceIds: number[], jobId: string) => Promise<boolean>;
  /**
   * Drops the space's jobs waiting under `key` (`cancelled`), and answers how many. With `olderThan`, only the ones
   * enqueued before that job — created earlier, or at the same instant with a smaller id — so of two set at once the
   * newer is the one left, on every replica. A running one is left: it is usually the run that set the next.
   */
  cancelPending: (params: { spaceId: number; key: string; olderThan?: string }) => Promise<number>;
};
