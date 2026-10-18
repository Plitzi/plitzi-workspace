import { TERMINAL_JOB_STATUSES } from '@plitzi/sdk-shared/actions';

import { createStoreClock } from '../actions/jobs/storeClock';

import type {
  Job,
  JobInput,
  JobQuery,
  JobQueue,
  JobSettlement,
  JobStatus,
  JobStop,
  JobWrite,
  ActionSchedule,
  ActionScheduleInput
} from '@plitzi/sdk-shared';
import type { Collection, Db, Document } from 'mongodb';

/** Mongo's code for a unique index that refused a second document with the same key. */
const DUPLICATE_KEY = 11000;

/** Mongo's code for a collection that does not exist yet. */
const NAMESPACE_NOT_FOUND = 26;

/** Spread into a plain array: the queries take a mutable list. */
const TERMINAL: JobStatus[] = [...TERMINAL_JOB_STATUSES];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The index jobs were looked up by their action with, before they had a target. */
const LEGACY_ACTION_INDEX = 'spaceId_1_actionId_1_updatedAt_-1';

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
        error: 'the worker holding this job stopped reporting'
      }
    ]
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
 * import { createMongoJobQueue } from '@plitzi/sdk-server/mongo';
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

  /** Whether the index jobs were found by before targets is there — on a collection not made yet, nothing is. */
  const legacyIndexIsThere = async (): Promise<boolean> => {
    try {
      return await jobsOf().indexExists(LEGACY_ACTION_INDEX);
    } catch (error) {
      if ((error as { code?: number }).code === NAMESPACE_NOT_FOUND) {
        return false;
      }

      throw error;
    }
  };

  /**
   * The indexes the queue cannot work without, built once on first use.
   *
   * `claim` is the one that matters: it runs on every poll of every replica, and without an index over status and the
   * two time fields it is a collection scan several times a second. The two branches of its `$or` are answered by one
   * index each and merged already sorted.
   */
  const build = async (): Promise<void> => {
    // A job written before jobs had a target is a run of an action, as every job then was: given its target once, and
    // the index on the field it replaced taken away (it is not there on a queue made since — nothing to drop).
    await jobsOf().updateMany({ target: { $exists: false } }, [
      { $set: { target: { kind: 'action', name: '$actionId', trigger: '$trigger' } } },
      { $unset: ['actionId', 'trigger'] }
    ]);
    if (await legacyIndexIsThere()) {
      await jobsOf().dropIndex(LEGACY_ACTION_INDEX);
    }

    await Promise.all([
      jobsOf().createIndex({ status: 1, runAt: 1 }),
      jobsOf().createIndex({ status: 1, leaseUntil: 1 }),
      jobsOf().createIndex({ spaceId: 1, updatedAt: -1 }),
      jobsOf().createIndex({ spaceId: 1, 'target.name': 1, updatedAt: -1 }),
      // Only runs set for later carry a key: the index holds those and nothing else.
      jobsOf().createIndex({ spaceId: 1, key: 1, status: 1 }, { partialFilterExpression: { key: { $exists: true } } }),
      jobsOf().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
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

    claim: async ({ workerId, leaseMs, limit }) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const taken: Job[] = [];

      // One document at a time, because `findOneAndUpdate` is the atomic unit: a multi-document update could hand
      // the same job to two workers between the read and the write.
      for (let slot = 0; slot < limit; slot += 1) {
        const claimed = await jobs.findOneAndUpdate(
          {
            $or: [
              { status: 'pending', runAt: { $lte: at } },
              // A lapsed lease is a worker that died. Reaping is part of claiming rather than a second job somebody
              // has to deploy, schedule and remember.
              { status: 'running', leaseUntil: { $lt: at } }
            ]
          },
          [
            { $set: { history: { $cond: [{ $eq: ['$status', 'running'] }, lostAttempt(at), '$history'] } } },
            {
              $set: {
                status: 'running',
                workerId,
                leaseUntil: at + leaseMs,
                updatedAt: at,
                attempts: { $add: ['$attempts', 1] }
              }
            }
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

    heartbeat: async ({ jobIds, workerId, leaseMs }) => {
      const { jobs } = await collections();
      const at = await clock.now();
      await jobs.updateMany(
        { _id: { $in: jobIds }, workerId, status: 'running' },
        { $set: { leaseUntil: at + leaseMs } }
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
        { $set: { status: 'pending', runAt: at, updatedAt: at } }
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
