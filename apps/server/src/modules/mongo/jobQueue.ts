import { createStoreClock } from '../actions/jobs/storeClock';

import type {
  ActionJob,
  ActionJobInput,
  ActionJobQuery,
  ActionJobQueue,
  ActionJobSettlement,
  ActionJobStatus,
  ActionSchedule,
  ActionScheduleInput
} from '@plitzi/sdk-shared';
import type { Collection, Db, Document } from 'mongodb';

/** Mongo's code for a unique index that refused a second document with the same key. */
const DUPLICATE_KEY = 11000;

const TERMINAL: ActionJobStatus[] = ['succeeded', 'failed', 'dead', 'cancelled'];

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

export type MongoJobQueue = ActionJobQueue & {
  /** Takes the store's clock again on the next call — after a failover to another primary. */
  resyncClock: () => void;
};

type JobDocument = Omit<ActionJob, 'id'> & {
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

const toJob = ({ _id, expiresAt: _expiresAt, ...rest }: JobDocument): ActionJob => withoutNulls({ ...rest, id: _id });

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
 * An {@link ActionJobQueue} over two collections of a Mongo database the deployment owns.
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
      jobsOf().createIndex({ spaceId: 1, actionId: 1, updatedAt: -1 }),
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

    enqueue: async (job: ActionJobInput) => {
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
      const taken: ActionJob[] = [];

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
        .find({ _id: { $in: jobIds }, workerId, status: 'running', cancelRequested: true })
        .project<{ _id: string }>({ _id: 1 })
        .toArray();

      return stopping.map(job => job._id);
    },

    settle: async ({ jobId, workerId, status, delayMs, runId, error, attempt }: ActionJobSettlement) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const entry: Document = {
        attempt: { $add: [{ $size: '$history' }, 1] },
        startedAt: '$updatedAt',
        endedAt: at,
        ...attempt
      };

      await jobs.updateOne(
        // Scoped to the holder: a settlement from a worker whose lease already lapsed is a report about a job
        // somebody else now owns, and writing it would overwrite a live attempt with a stale verdict.
        { _id: jobId, workerId },
        [
          {
            $set: {
              ...(attempt ? { history: { $concatArrays: ['$history', [entry]] } } : {}),
              status,
              updatedAt: at,
              leaseUntil: null,
              error: error ?? null,
              ...(runId ? { runId } : {}),
              ...(status === 'pending'
                ? {
                    runAt: at + (delayMs ?? 0),
                    workerId: null,
                    // Handed back untouched: the worker never got to run it, so the attempt it took is given back.
                    ...(attempt ? {} : { attempts: { $max: [0, { $subtract: ['$attempts', 1] }] } })
                  }
                : {}),
              expiresAt: TERMINAL.includes(status) ? expiryOf(at) : null
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

    listJobs: async ({ spaceIds, actionId, status, limit, offset }: ActionJobQuery) => {
      const { jobs } = await collections();
      const filter = {
        spaceId: { $in: spaceIds },
        ...(actionId ? { actionId } : {}),
        ...(status ? { status } : {})
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

    requeue: async (spaceIds, jobId) => {
      const { jobs } = await collections();
      const at = await clock.now();
      // Any finished job, including one that went fine: an operator repeating last night's digest is asking for it
      // to happen again, and refusing because it already worked would be refusing the normal case.
      const result = await jobs.updateOne(
        { _id: jobId, spaceId: { $in: spaceIds }, status: { $in: TERMINAL } },
        {
          $set: { status: 'pending', runAt: at, attempts: 0, updatedAt: at, cancelRequested: false },
          // The history is NOT cleared: what has already been tried is the reason somebody is looking at this job.
          $unset: { workerId: '', leaseUntil: '', error: '', expiresAt: '' }
        }
      );

      return result.matchedCount === 1;
    },

    cancel: async (spaceIds, jobId) => {
      const { jobs } = await collections();
      const at = await clock.now();
      const dropped = await jobs.updateOne(
        { _id: jobId, spaceId: { $in: spaceIds }, status: 'pending' },
        { $set: { status: 'cancelled', updatedAt: at, expiresAt: expiryOf(at) }, $unset: { workerId: '' } }
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
    }
  };
};
