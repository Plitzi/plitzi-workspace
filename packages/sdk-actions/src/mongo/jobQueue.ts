import { TERMINAL_JOB_STATUSES } from '@plitzi/sdk-shared/actions';

import { flowOf } from '../engine/jobs/flow';
import { LOST_ERROR, LOST_MEMORY_WORDS, SET_ASIDE_WORDS } from '../engine/jobs/memoryNeeds';
import { noJobsByStatus, WAITING_STATUSES, waitingKindOf } from '../engine/jobs/queueRules';
import { createStoreClock } from '../engine/jobs/storeClock';

import type {
  JobQuery,
  JobQueue,
  JobSettlement,
  JobSpaces,
  JobStop,
  JobWrite,
  ActionSchedule,
  ActionScheduleInput,
  WaitingJobs
} from '../types';
import type { Job, JobInput, JobStatus } from '@plitzi/sdk-shared';
import type { Collection, Db, Document } from 'mongodb';

/** Mongo's code for a unique index that refused a second document with the same key. */
const DUPLICATE_KEY = 11000;

/** Spread into a plain array: the queries take a mutable list. */
const TERMINAL: JobStatus[] = [...TERMINAL_JOB_STATUSES];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The database, or how to reach it — a getter for a deployment whose client is replaced when it reconnects. */
export type MongoDbSource = Db | (() => Db);

export const resolveDb = (source: MongoDbSource): Db => (typeof source === 'function' ? source() : source);

export type MongoJobQueueOptions = {
  db: MongoDbSource;
  /** Collection names, for a deployment with a naming scheme of its own. */
  collections?: { jobs?: string; schedules?: string };
  /** How long a finished job stays readable. A waiting or running one never expires. Default 90 days. */
  retentionDays?: number;
};

export type MongoJobQueue = JobQueue & {
  /** Takes the store's clock again on the next call — after a failover to another primary. */
  resyncClock: () => void;
};

type JobDocument = Omit<Job, 'id'> & {
  _id: string;
  /** Set only once a job is finished, so a job still waiting or running is never expired out from under anybody. */
  expiresAt?: Date | null;
};

type ScheduleDocument = ActionSchedule & { _id: string };

const scheduleId = (spaceId: number, actionId: string) => `${spaceId}:${actionId}`;

/**
 * A stored document as the contract shapes it: an optional field is absent, never `null`.
 *
 * Mongo keeps what a `$set` wrote, and clearing a field in an update pipeline writes `null` — so a released job would
 * otherwise come back with `workerId: null`, which every reader typed as `string | undefined` gets wrong.
 */
const withoutNulls = <T extends Document>(document: T): T =>
  // `Object.fromEntries` forgets the shape it was given; the keys are the same ones, fewer of them.
  Object.fromEntries(Object.entries(document).filter(([, value]) => value !== null)) as T;

const toJob = ({ _id, expiresAt: _expiresAt, ...rest }: JobDocument): Job => withoutNulls({ ...rest, id: _id });

const toSchedule = ({ _id: _unused, ...rest }: ScheduleDocument): ActionSchedule => withoutNulls(rest);

/** The history entry a reclaim writes on behalf of a worker that never came back. */
const lostAttempt = (at: number): Document => ({
  $concatArrays: [
    '$history',
    [
      {
        attempt: { $add: [{ $size: '$history' }, 1] },
        status: 'lost',
        startedAt: '$updatedAt',
        endedAt: at,
        workerId: { $ifNull: ['$workerId', 'unknown'] },
        error: LOST_ERROR,
        // Missing when its worker said nothing of its memory, or did not near it, and a missing value is not written.
        memoryMb: '$holderMemoryMb',
        nearMemoryLimit: '$nearMemoryLimit'
      }
    ]
  ]
});

/**
 * Whether the job took the worker that held it down, and that worker said what it could hold: `outgrewWorker` — it
 * neared its memory, or the attempt before was lost too — read over the document before its lost attempt is written.
 */
const outgrewSaid: Document = {
  $and: [
    { $ne: [{ $type: '$holderMemoryMb' }, 'missing'] },
    {
      $or: [
        { $eq: ['$nearMemoryLimit', true] },
        { $eq: [{ $arrayElemAt: [{ $ifNull: ['$history.status', []] }, -1] }, 'lost'] }
      ]
    }
  ]
};

/** `needsAfterLoss`, as Mongo computes it over the document. */
const needsAfterLossOf: Document = {
  $cond: [
    outgrewSaid,
    { $max: [{ $ifNull: ['$needsMemoryMb', 0] }, { $add: ['$holderMemoryMb', 1] }] },
    '$needsMemoryMb'
  ]
};

/** `lostError`, as Mongo composes it over the document. */
const lostErrorOf: Document = {
  $cond: [
    outgrewSaid,
    { $concat: [LOST_MEMORY_WORDS[0], { $toString: '$holderMemoryMb' }, LOST_MEMORY_WORDS[1]] },
    LOST_ERROR
  ]
};

/** What a claim with these `spaces` and `memoryMb` takes at `at`: due and waiting, of its spaces — or a job a worker died
 * running that this one may hold, whatever its spaces. */
const claimable = (at: number, spaces: JobSpaces | undefined, memoryMb: number | undefined): Document => ({
  status: 'pending',
  runAt: { $lte: at },
  $or: [
    {
      needsMemoryMb: { $exists: false },
      ...(spaces ? { spaceId: 'only' in spaces ? { $in: spaces.only } : { $nin: spaces.except } } : {})
    },
    ...(memoryMb === undefined ? [] : [{ needsMemoryMb: { $lte: memoryMb } }])
  ]
});

/** `setAsideError`, as Mongo composes it over the document. */
const setAsideErrorOf = (ceilingMb: number): Document => ({
  $concat: [
    SET_ASIDE_WORDS[0],
    { $toString: { $subtract: ['$needsMemoryMb', 1] } },
    SET_ASIDE_WORDS[1],
    String(ceilingMb),
    SET_ASIDE_WORDS[2]
  ]
});

/**
 * An {@link JobQueue} over two collections of a Mongo database the deployment owns.
 *
 * The helper for a deployment that already runs Mongo: it holds no connection of its own and creates nothing but the
 * indexes its queries need, on first use. Every replica pointed at the same database shares the jobs and the
 * schedules, which is what running more than one needs.
 *
 * ```ts
 * import { createMongoJobQueue } from '@plitzi/sdk-actions/mongo';
 *
 * const queue = createMongoJobQueue({ db: client.db('app') });
 * createServer({ action: { lookups, kv, jobs: { queue } } });
 * ```
 *
 * The contract's rules, as Mongo keeps them: every instant is the SERVER's (`hello.localTime`), `enqueue` is idempotent
 * by the job's `_id`, `claim` takes one document per `findOneAndUpdate` — the atomic unit — and reaps a lapsed lease in
 * the same operation, and a schedule advances by compare-and-set on the instant that was read.
 */
export const createMongoJobQueue = ({
  db,
  collections: names = {},
  retentionDays = 90
}: MongoJobQueueOptions): MongoJobQueue => {
  const jobsName = names.jobs ?? 'action_jobs';
  const schedulesName = names.schedules ?? 'action_schedules';

  const jobsOf = () => resolveDb(db).collection<JobDocument>(jobsName);
  const schedulesOf = () => resolveDb(db).collection<ScheduleDocument>(schedulesName);

  const clock = createStoreClock(async () => {
    const { localTime } = (await resolveDb(db).command({ hello: 1 })) as { localTime?: Date };

    return localTime ? localTime.getTime() : Date.now();
  });

  let ready: Promise<void> | undefined;

  /**
   * The indexes the queue cannot work without, built once on first use.
   *
   * `claim` is the one that matters: it runs on every poll of every replica, and without an index over status and the
   * two time fields it is a collection scan several times a second. The two branches of its `$or` are answered by one
   * index each and merged already sorted.
   */
  const build = async (): Promise<void> => {
    await Promise.all([
      jobsOf().createIndex({ status: 1, runAt: 1 }),
      jobsOf().createIndex({ status: 1, leaseUntil: 1 }),
      jobsOf().createIndex({ spaceId: 1, updatedAt: -1 }),
      jobsOf().createIndex({ spaceId: 1, 'target.name': 1, updatedAt: -1 }),
      // Only runs set for later carry a key: the index holds those and nothing else.
      jobsOf().createIndex({ spaceId: 1, key: 1, status: 1 }, { partialFilterExpression: { key: { $exists: true } } }),
      jobsOf().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      jobsOf().createIndex({ dueAt: 1 }),
      jobsOf().createIndex({ updatedAt: 1 }),
      schedulesOf().createIndex({ enabled: 1, nextRunAt: 1 }),
      schedulesOf().createIndex({ spaceId: 1 })
    ]);
  };

  const collections = async (): Promise<{ jobs: Collection<JobDocument>; schedules: Collection<ScheduleDocument> }> => {
    ready ??= build().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    await ready;

    return { jobs: jobsOf(), schedules: schedulesOf() };
  };

  const expiryOf = (at: number): Date => new Date(at + retentionDays * DAY_MS);

  return {
    resyncClock: clock.resync,

    now: async () => new Date(await clock.now()),

    enqueue: async (job: JobInput) => {
      const { jobs } = await collections();
      const at = await clock.now();
      // `id` becomes the document's `_id`; stored twice it could disagree with itself.
      const { id, ...fields } = job;
      const document: JobDocument = {
        ...fields,
        _id: id,
        status: 'pending',
        // The fire's own instant, so a job produced late is still claimable at once rather than waiting again.
        runAt: job.dueAt,
        attempts: 0,
        createdAt: at,
        updatedAt: at,
        history: []
      };
      try {
        await jobs.insertOne(document);

        return true;
      } catch (error) {
        // The id is the fire, so a second replica reaching the same fire lands here. It is the guarantee working,
        // not a failure: whoever inserted first owns the job.
        if ((error as { code?: number }).code === DUPLICATE_KEY) {
          return false;
        }

        throw error;
      }
    },

    claim: async ({ workerId, leaseMs, limit, spaces, memory }) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const taken: Job[] = [];

      // Reaped first, whoever claims: a lapsed lease is a worker that died. Reaping is part of claiming rather than a
      // second job somebody has to deploy, schedule and remember — and each document is reaped once, however many
      // claim at once: the filter is read again as each one is written.
      await jobs.updateMany({ status: 'running', leaseUntil: { $lt: at } }, [
        {
          $set: {
            history: lostAttempt(at),
            needsMemoryMb: needsAfterLossOf,
            error: lostErrorOf,
            status: 'pending',
            updatedAt: at
          }
        },
        { $unset: ['workerId', 'leaseUntil', 'holderMemoryMb', 'nearMemoryLimit'] }
      ]);
      if (memory) {
        await jobs.updateMany({ status: 'pending', needsMemoryMb: { $gt: memory.ceilingMb } }, [
          { $set: { status: 'paused', error: setAsideErrorOf(memory.ceilingMb), updatedAt: at } }
        ]);
      }

      // One document at a time, because `findOneAndUpdate` is the atomic unit: a multi-document update could hand
      // the same job to two workers between the read and the write.
      for (let slot = 0; slot < limit; slot += 1) {
        const claimed = await jobs.findOneAndUpdate(
          claimable(at, spaces, memory?.takesNeeding === false ? undefined : memory?.mb),
          [
            {
              $set: {
                status: 'running',
                workerId,
                leaseUntil: at + leaseMs,
                updatedAt: at,
                attempts: { $add: ['$attempts', 1] },
                ...(memory ? { holderMemoryMb: memory.mb } : {})
              }
            },
            { $unset: 'nearMemoryLimit' }
          ],
          { sort: { runAt: 1 }, returnDocument: 'after' }
        );

        if (!claimed) {
          break;
        }

        taken.push(toJob(claimed));
      }

      return taken;
    },

    heartbeat: async ({ jobIds, workerId, leaseMs, nearMemoryLimit }) => {
      const { jobs } = await collections();
      const at = await clock.now();
      await jobs.updateMany(
        { _id: { $in: jobIds }, workerId, status: 'running' },
        { $set: { leaseUntil: at + leaseMs, ...(nearMemoryLimit ? { nearMemoryLimit: true } : {}) } }
      );

      const stopping = await jobs
        .find({
          _id: { $in: jobIds },
          workerId,
          status: 'running',
          $or: [{ cancelRequested: true }, { pauseRequested: true }]
        })
        .project<{ _id: string; cancelRequested?: boolean }>({ _id: 1, cancelRequested: 1 })
        .toArray();

      // A cancel wins over a pause asked of the same job: set aside, it would only wait to be dropped.
      return stopping.map(job => ({
        jobId: job._id,
        stop: (job.cancelRequested === true ? 'cancel' : 'pause') satisfies JobStop
      }));
    },

    write: async ({ jobId, workerId, state, progress }: JobWrite) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const written = await jobs.updateOne(
        { _id: jobId, workerId, status: 'running' },
        {
          $set: {
            updatedAt: at,
            ...(state === undefined ? {} : { state }),
            ...(progress ? { progress: { ...progress, at } } : {})
          }
        }
      );

      return written.matchedCount === 1;
    },

    settle: async ({
      jobId,
      workerId,
      status,
      delayMs,
      runId,
      error,
      attempt,
      result,
      spentMs,
      refund = status === 'pending' && !attempt
    }: JobSettlement) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const entry: Document = {
        attempt: { $add: [{ $size: '$history' }, 1] },
        startedAt: '$updatedAt',
        endedAt: at,
        ...attempt
      };
      // Asked to stop while it was settling: the next slice it was handed back for is what that stop was about.
      const settled =
        status === 'pending'
          ? {
              $cond: [
                { $eq: ['$cancelRequested', true] },
                'cancelled',
                { $cond: [{ $eq: ['$pauseRequested', true] }, 'paused', 'pending'] }
              ]
            }
          : status;

      await jobs.updateOne(
        // Scoped to the holder: a settlement from a worker whose lease already lapsed is a report about a job
        // somebody else now owns, and writing it would overwrite a live attempt with a stale verdict.
        { _id: jobId, workerId },
        [
          {
            $set: {
              ...(attempt ? { history: { $concatArrays: ['$history', [entry]] } } : {}),
              status: settled,
              updatedAt: at,
              leaseUntil: null,
              error: error ?? null,
              cancelRequested: null,
              pauseRequested: null,
              ...(runId ? { runId } : {}),
              ...(result === undefined ? {} : { result: { $literal: result } }),
              ...(spentMs ? { activeMs: { $add: [{ $ifNull: ['$activeMs', 0] }, spentMs] } } : {}),
              // Handed back untouched, or a slice that did not fail: the attempt it took is given back too.
              ...(refund ? { attempts: { $max: [0, { $subtract: ['$attempts', 1] }] } } : {})
            }
          },
          {
            $set: {
              runAt: { $cond: [{ $eq: ['$status', 'pending'] }, at + (delayMs ?? 0), '$runAt'] },
              workerId: { $cond: [{ $in: ['$status', ['pending', 'paused']] }, null, '$workerId'] },
              expiresAt: { $cond: [{ $in: ['$status', TERMINAL] }, expiryOf(at), null] }
            }
          }
        ]
      );
    },

    dueSchedules: async limit => {
      const { schedules } = await collections();
      const at = await clock.now();
      const due = await schedules
        .find({ enabled: true, nextRunAt: { $lte: at } })
        .sort({ nextRunAt: 1 })
        .limit(limit)
        .toArray();

      return due.map(toSchedule);
    },

    advanceSchedule: async ({ spaceId, actionId, from, to, missed }) => {
      const { schedules } = await collections();
      const at = await clock.now();
      // Compare-and-set on the very value that was read: two replicas that swept the same fire cannot both move it,
      // so the schedule advances exactly once however many of them got there.
      const result = await schedules.updateOne(
        { _id: scheduleId(spaceId, actionId), nextRunAt: from },
        { $set: { nextRunAt: to, lastFireAt: from, updatedAt: at }, $inc: { missed } }
      );

      return result.matchedCount === 1;
    },

    putSchedules: async ({ spaceId, schedules: incoming }) => {
      const { schedules } = await collections();
      const at = await clock.now();

      if (incoming.length > 0) {
        await schedules.bulkWrite(
          incoming.map((schedule: ActionScheduleInput) => ({
            updateOne: {
              filter: { _id: scheduleId(spaceId, schedule.actionId) },
              update: [
                {
                  $set: {
                    ...schedule,
                    timezone: schedule.timezone ?? null,
                    updatedAt: at,
                    missed: { $ifNull: ['$missed', 0] },
                    // A fire already promised is kept. Recomputing it on every save would let a space somebody is
                    // actively editing push its own schedule forward forever and never reach a due time at all.
                    nextRunAt: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$cron', schedule.cron] },
                            { $eq: [{ $ifNull: ['$timezone', null] }, schedule.timezone ?? null] },
                            { $eq: ['$environment', schedule.environment] },
                            { $ne: [{ $ifNull: ['$nextRunAt', null] }, null] }
                          ]
                        },
                        '$nextRunAt',
                        schedule.nextRunAt
                      ]
                    }
                  }
                }
              ],
              upsert: true
            }
          }))
        );
      }

      // An action that stopped declaring a schedule stops having one. Scoped to this space, so a reconcile of one
      // space never touches another's.
      await schedules.deleteMany({
        spaceId,
        actionId: { $nin: incoming.map(schedule => schedule.actionId) }
      });
    },

    listJobs: async ({ spaceIds, name, status, kind, limit, offset }: JobQuery) => {
      const { jobs } = await collections();
      const filter = {
        spaceId: { $in: spaceIds },
        ...(name ? { 'target.name': name } : {}),
        ...(status ? { status } : {}),
        ...(kind ? { 'target.kind': kind } : {})
      };

      const [found, total] = await Promise.all([
        jobs.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(offset).limit(limit).toArray(),
        jobs.countDocuments(filter)
      ]);

      return { jobs: found.map(toJob), total };
    },

    listAcross: async ({ statuses, limit, order }) => {
      const { jobs } = await collections();
      const found = await jobs
        .find({ status: { $in: statuses } })
        .sort(order === 'due' ? { runAt: 1, _id: 1 } : { updatedAt: -1, _id: -1 })
        .limit(limit)
        .toArray();

      return found.map(toJob);
    },

    summarize: async ({ spaces = 10 } = {}) => {
      const { jobs } = await collections();
      const waitingNow = { status: { $in: [...WAITING_STATUSES] } };
      // One pass over the collection, three answers: every status, what waits by kind, the spaces with most waiting —
      // a `$facet` answers one document even over an empty collection.
      const [found] = await jobs
        .aggregate<{
          byStatus: { _id: JobStatus; n: number }[];
          waiting: { _id: { kind: string; trigger?: string | null }; n: number; oldest: number }[];
          spaces: { _id: number; waiting: number; calls: number; oldestDueAt: number; lastError?: string | null }[];
          needingMemory: { _id: JobStatus; n: number; most: number }[];
        }>([
          {
            $facet: {
              byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
              needingMemory: [
                { $match: { ...waitingNow, needsMemoryMb: { $exists: true } } },
                { $group: { _id: '$status', n: { $sum: 1 }, most: { $max: '$needsMemoryMb' } } }
              ],
              waiting: [
                { $match: waitingNow },
                {
                  $group: {
                    _id: { kind: '$target.kind', trigger: '$target.trigger' },
                    n: { $sum: 1 },
                    oldest: { $min: '$dueAt' }
                  }
                }
              ],
              spaces: [
                { $match: waitingNow },
                { $sort: { updatedAt: 1 } },
                {
                  $group: {
                    _id: '$spaceId',
                    waiting: { $sum: 1 },
                    calls: { $sum: { $cond: [{ $eq: ['$target.trigger', 'call'] }, 1, 0] } },
                    oldestDueAt: { $min: '$dueAt' },
                    lastError: { $last: '$error' }
                  }
                },
                { $sort: { waiting: -1, oldestDueAt: 1 } },
                // Mongo refuses a `$limit` of 0: one is read, and none of it kept, when no space is asked for.
                { $limit: Math.max(1, spaces) }
              ]
            }
          }
        ])
        .toArray();
      const byStatus = noJobsByStatus();
      found.byStatus.forEach(each => {
        byStatus[each._id] = each.n;
      });
      const waiting: WaitingJobs = { calls: 0, schedules: 0, later: 0, functionJobs: 0, other: 0 };
      let oldestDueAt: number | undefined;
      found.waiting.forEach(each => {
        waiting[waitingKindOf(each._id.kind, each._id.trigger)] += each.n;
        oldestDueAt = oldestDueAt === undefined ? each.oldest : Math.min(oldestDueAt, each.oldest);
      });

      const waitingForMemory = found.needingMemory.find(each => each._id === 'pending');

      return {
        byStatus,
        waiting,
        ...(oldestDueAt === undefined ? {} : { oldestDueAt }),
        needingMemory: {
          waiting: waitingForMemory?.n ?? 0,
          paused: found.needingMemory.find(each => each._id === 'paused')?.n ?? 0,
          ...(waitingForMemory ? { mostMb: waitingForMemory.most } : {})
        },
        spaces: found.spaces.slice(0, spaces).map(each => ({
          spaceId: each._id,
          waiting: each.waiting,
          calls: each.calls,
          oldestDueAt: each.oldestDueAt,
          ...(each.lastError ? { lastError: each.lastError } : {})
        }))
      };
    },

    flow: async ({ from, to }) => {
      const { jobs } = await collections();
      const touching = await jobs
        .find(
          { $or: [{ dueAt: { $gte: from, $lt: to } }, { updatedAt: { $gte: from } }] },
          { projection: { _id: 0, dueAt: 1, history: 1, status: 1, updatedAt: 1, attempts: 1 } }
        )
        .toArray();

      return flowOf(touching, from, to);
    },

    countDue: async ({ spaces, memoryMb } = {}) => {
      const { jobs } = await collections();

      return jobs.countDocuments(claimable(await clock.now(), spaces, memoryMb));
    },

    getJob: async (spaceIds, jobId) => {
      const { jobs } = await collections();
      const job = await jobs.findOne({ _id: jobId, spaceId: { $in: spaceIds } });

      return job ? toJob(job) : undefined;
    },

    listSchedules: async spaceIds => {
      const { schedules } = await collections();
      const found = await schedules
        .find({ spaceId: { $in: spaceIds } })
        .sort({ nextRunAt: 1 })
        .toArray();

      return found.map(toSchedule);
    },

    requeue: async (spaceIds, jobId, { input, fresh = false } = {}) => {
      const { jobs } = await collections();
      const at = await clock.now();
      // Any finished job, including one that went fine: an operator repeating last night's digest is asking for it
      // to happen again, and refusing because it already worked would be refusing the normal case.
      const result = await jobs.updateOne(
        { _id: jobId, spaceId: { $in: spaceIds }, status: { $in: TERMINAL } },
        {
          $set: { status: 'pending', runAt: at, attempts: 0, updatedAt: at, ...(input ? { input } : {}) },
          // The history is NOT cleared: what has already been tried is the reason somebody is looking at this job.
          $unset: {
            workerId: '',
            leaseUntil: '',
            error: '',
            expiresAt: '',
            result: '',
            cancelRequested: '',
            pauseRequested: '',
            ...(fresh ? { state: '', progress: '', activeMs: '' } : {})
          }
        }
      );

      return result.matchedCount === 1;
    },

    cancel: async (spaceIds, jobId) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const dropped = await jobs.updateOne(
        { _id: jobId, spaceId: { $in: spaceIds }, status: { $in: ['pending', 'paused'] } },
        {
          $set: { status: 'cancelled', updatedAt: at, expiresAt: expiryOf(at) },
          $unset: { workerId: '', pauseRequested: '' }
        }
      );
      if (dropped.matchedCount === 1) {
        return true;
      }

      // Running: only the replica holding it can stop the flow, so the request is left where its heartbeat reads it.
      const flagged = await jobs.updateOne(
        { _id: jobId, spaceId: { $in: spaceIds }, status: 'running' },
        { $set: { cancelRequested: true, updatedAt: at } }
      );

      return flagged.matchedCount === 1;
    },

    pause: async (spaceIds, jobId) => {
      const { jobs } = await collections();
      const at = await clock.now();
      // Only a job of the space's functions saves where it is: a flow set aside would only start again from nothing.
      const own = { _id: jobId, spaceId: { $in: spaceIds }, 'target.kind': 'function' };
      const waiting = await jobs.updateOne(
        { ...own, status: 'pending' },
        { $set: { status: 'paused', updatedAt: at } }
      );
      if (waiting.matchedCount === 1) {
        return true;
      }

      const flagged = await jobs.updateOne(
        { ...own, status: 'running', pauseRequested: { $ne: true } },
        { $set: { pauseRequested: true, updatedAt: at } }
      );

      return flagged.matchedCount === 1;
    },

    resume: async (spaceIds, jobId) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const resumed = await jobs.updateOne(
        { _id: jobId, spaceId: { $in: spaceIds }, status: 'paused' },
        // Set aside after failing every attempt: resumed once fixed, it has them all again.
        [
          {
            $set: {
              status: 'pending',
              runAt: at,
              updatedAt: at,
              attempts: { $cond: [{ $gte: ['$attempts', '$maxAttempts'] }, 0, '$attempts'] }
            }
          }
        ]
      );

      return resumed.matchedCount === 1;
    },

    cancelPending: async ({ spaceId, key, olderThan }) => {
      const { jobs } = await collections();
      const newest = olderThan === undefined ? undefined : await jobs.findOne({ _id: olderThan });
      const at = await clock.now();
      const dropped = await jobs.updateMany(
        {
          spaceId,
          key,
          status: 'pending',
          ...(newest
            ? {
                $or: [
                  { createdAt: { $lt: newest.createdAt } },
                  { createdAt: newest.createdAt, _id: { $lt: newest._id } }
                ]
              }
            : {})
        },
        { $set: { status: 'cancelled', updatedAt: at, expiresAt: expiryOf(at) }, $unset: { workerId: '' } }
      );

      return dropped.modifiedCount;
    }
  };
};
