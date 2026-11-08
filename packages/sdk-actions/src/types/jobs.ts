import type { Environment, Job, JobAttempt, JobInput, JobProgress, JobStatus, JobTarget } from '@plitzi/sdk-shared';

/**
 * Which spaces' jobs a worker takes: only these — a worker kept for some spaces — or every space but these, whose own
 * workers take theirs. Absent, every space's.
 */
export type JobSpaces = { only: number[] } | { except: number[] };

/**
 * How replicas tell each other a job is due now, beside each worker looking every `pollMs`: `notify` as one is enqueued
 * or handed back due, `listen` for it — a deployment's pub/sub. Without it a worker finds a new job on its next look: up
 * to `pollMs` late, half of it on average, with nothing else to do.
 */
export type JobWake = {
  notify: () => void;
  /** Called on every notice from any replica, this one's included; answers how to stop listening. */
  listen: (onWake: () => void) => () => void;
};

/**
 * A kind of work, as a worker's claim shares its room between them: actions that run no space code (`light`, needing no
 * runner), actions that do (`codeActions`, `target.code`), and the spaces' functions' jobs (`functionJobs`).
 */
export type JobTake = 'light' | 'codeActions' | 'functionJobs';

/** Why a worker is asked to stop a job it holds: an operator or the code cancelled it, or set it aside. */
export type JobStop = 'cancel' | 'pause';

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

/**
 * What a worker may hold, said as it claims, so the queue moves a job a worker died running to a larger one rather than
 * let it kill the next of the same size. A deployment whose workers say nothing keeps the queue as it always was: a job
 * whose worker died runs again on whichever claims it.
 */
export type JobClaimMemory = {
  /** What this worker may hold, in MiB: its container's memory. */
  mb: number;
  /** The most any worker of the deployment may hold, in MiB: a job that needs more is set aside (`paused`), saying so. */
  ceilingMb: number;
  /**
   * Whether it takes a job a worker died running, besides its own: not while it runs one already — each may need all it
   * has. Default yes.
   */
  takesNeeding?: boolean;
};

/** The jobs a worker died running, as `summarize` counts them. */
export type JobsNeedingMemory = {
  /** Waiting for a worker that may hold more than the one that died running them. */
  waiting: number;
  /** Set aside: no worker of the deployment may hold what they need. */
  paused: number;
  /** The most any of them waiting needs, in MiB: what a deployment keeps a worker of, while they wait. */
  mostMb?: number;
};

/** What waits in the queue — `pending` or `paused` — by what it is. */
export type WaitingJobs = {
  /** Visitors' calls kept because nothing could run them when they were made. */
  calls: number;
  /** Schedules' fires. */
  schedules: number;
  /** Runs set for later (`ctx.later`). */
  later: number;
  /** Jobs of the spaces' functions. */
  functionJobs: number;
  /** Anything else: a webhook's, a custom trigger's. */
  other: number;
};

/** A queue at a glance — see `JobQueue.summarize`. */
export type JobQueueSummary = {
  byStatus: Record<JobStatus, number>;
  waiting: WaitingJobs;
  /** When the job waiting longest was due, epoch ms by the queue's clock; absent with nothing waiting. */
  oldestDueAt?: number;
  /** The jobs a worker died running, waiting for a larger one or set aside. */
  needingMemory: JobsNeedingMemory;
  /** The spaces with the most waiting, the most first: how many, how many of them kept calls, since when, and why. */
  spaces: {
    spaceId: number;
    waiting: number;
    calls: number;
    oldestDueAt: number;
    /** What the last job of it handed back said: `Waiting for a functions runner to answer`. */
    lastError?: string;
  }[];
};

/** One minute of the queue's flow (`flow`): what an operator reads to tell whether it keeps up. */
export type JobFlowMinute = {
  /** Minutes since the epoch, UTC. */
  minute: number;
  /** Jobs that fell due in it: a schedule's fire, a kept call, a run set for later reaching its time. */
  due: number;
  /** Attempts started in it — the one running now included. */
  started: number;
  /** Attempts that ended in it, however they ended. */
  ended: number;
  /** Of the jobs whose first attempt started in it, the p95 of how long each waited from due to that start. */
  waitP95Ms?: number;
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
 * schedule and to forget. When the claims say what their workers may hold (`memory`), a reaped job that took its
 * worker down needs more than that one could: it waits for a worker that may, and is set aside (`paused`) when none may.
 */
export type JobQueue = {
  /** The cluster's clock. The only clock anything in the scheduling path is allowed to read. */
  now: () => Promise<Date>;
  /** True when this call created the job; false when that id was already there. Never throws on a duplicate. */
  enqueue: (job: JobInput) => Promise<boolean>;
  /**
   * Takes up to `limit` jobs that are due, and any whose lease has lapsed — atomically, one worker per job.
   *
   * A reaped job has its previous holder's attempt written to the history as `lost`. One that took that holder down —
   * it neared its memory holding it (`heartbeat`'s `nearMemoryLimit`), or the attempt before was lost too — then needs
   * more than the holder could hold, when its claim said (`needsMemoryMb`): taken by a worker that may, whatever its
   * `spaces`, or set aside (`paused`) when more than `memory.ceilingMb`. A job that needs more than this worker may hold
   * is left to another.
   */
  claim: (params: {
    workerId: string;
    leaseMs: number;
    limit: number;
    spaces?: JobSpaces;
    memory?: JobClaimMemory;
    /** Only jobs of one kind of work (`JobTake`): what a worker shares its room between. Absent, every job. */
    takes?: JobTake;
  }) => Promise<Job[]>;
  /**
   * Extends the lease on jobs this worker still holds, and answers which of them it is asked to stop — cancelled, or
   * set aside (`pause`). With `nearMemoryLimit`, this worker neared its memory: should it die holding them, they need
   * a larger one.
   */
  heartbeat: (params: {
    jobIds: string[];
    workerId: string;
    leaseMs: number;
    nearMemoryLimit?: boolean;
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
  /**
   * Jobs of EVERY space in these statuses — an operator's view, never a space's own (`listJobs` is): the longest due first
   * (`due`), or the latest written first (`latest`). What a monitoring screen lists of what waits, runs and just ended.
   */
  listAcross: (query: { statuses: JobStatus[]; limit: number; order: 'due' | 'latest' }) => Promise<Job[]>;
  /**
   * The whole queue at a glance, every space: what an operator reads to tell a queue that drains from one that fills —
   * its jobs by status, what waits by what it is, the oldest of it, and the spaces with the most waiting.
   */
  summarize: (options?: { spaces?: number }) => Promise<JobQueueSummary>;
  /**
   * How many jobs a claim with these `spaces` and `memoryMb` would take now — due and waiting, as `claim` reads them:
   * what an autoscaler adds to the work its workers hold, so a queue that grows behind a slow job grows the pool.
   */
  countDue: (params?: { spaces?: JobSpaces; memoryMb?: number }) => Promise<number>;
  /**
   * The queue's flow minute by minute over `[from, to)` (epoch ms, the queue's clock): what fell due, was started and
   * ended in each minute, and how long jobs waited for their first attempt — every space.
   */
  flow: (params: { from: number; to: number }) => Promise<JobFlowMinute[]>;
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
  /**
   * Puts a `paused` job back in the queue, to start again from what it saved — one set aside after failing every
   * attempt with every attempt again.
   */
  resume: (spaceIds: number[], jobId: string) => Promise<boolean>;
  /**
   * Drops the space's jobs waiting under `key` (`cancelled`), and answers how many. With `olderThan`, only the ones
   * enqueued before that job — created earlier, or at the same instant with a smaller id — so of two set at once the
   * newer is the one left, on every replica. A running one is left: it is usually the run that set the next.
   */
  cancelPending: (params: { spaceId: number; key: string; olderThan?: string }) => Promise<number>;
};
