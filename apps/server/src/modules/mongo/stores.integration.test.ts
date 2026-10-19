import { MongoClient } from 'mongodb';
import { afterAll, describe, expect, it } from 'vitest';

import { createMongoJobQueue } from './jobQueue';
import { createMongoKv } from './kv';
import { describeJobQueue, describeKv } from '../actions/jobs/tests/jobQueueContract';

/**
 * The Mongo helpers against a real Mongo, through the same contract the in-process stores keep.
 *
 * Skipped — not failed — on a machine with no Mongo: `MONGO_TEST_URL` points it at one, and the default is the port the
 * repository's docker services publish. Its own database, emptied before every test.
 */
const URL = process.env.MONGO_TEST_URL ?? 'mongodb://127.0.0.1:27010';
const DATABASE = 'sdk_server_itest';

const client = new MongoClient(URL, { serverSelectionTimeoutMS: 1_500 });
const available = await client
  .connect()
  .then(() => true)
  .catch(() => false);
const db = client.db(DATABASE);

afterAll(async () => {
  await client.close();
});

const emptied =
  (...names: string[]) =>
  async () => {
    await Promise.all(names.map(name => db.collection(name).deleteMany({})));
  };

describeJobQueue(
  'mongo',
  () =>
    Promise.resolve({
      queue: createMongoJobQueue({ db: () => db, collections: { jobs: 'itest_jobs', schedules: 'itest_schedules' } }),
      clear: emptied('itest_jobs', 'itest_schedules')
    }),
  available
);

describeKv(
  'mongo',
  () => Promise.resolve({ kv: createMongoKv({ db, collection: 'itest_kv' }), clear: emptied('itest_kv') }),
  available
);

describe.skipIf(!available)('mongo — a queue a release before left', () => {
  /** What 0.38.20 wrote: a run of an action, named by `actionId` and `trigger`, and indexed by them. */
  it('gives the jobs written before targets theirs, once, and drops the index they were found by', async () => {
    const jobs = db.collection('itest_legacy_jobs');
    await jobs.deleteMany({});
    await jobs.insertOne({
      _id: 'schedule:7:digest:1' as never,
      spaceId: 7,
      actionId: 'digest',
      trigger: 'schedule',
      environment: 'main',
      input: {},
      dueAt: 1,
      maxAttempts: 3,
      status: 'succeeded',
      runAt: 1,
      attempts: 1,
      createdAt: 1,
      updatedAt: 1,
      history: []
    });
    await jobs.createIndex({ spaceId: 1, actionId: 1, updatedAt: -1 });

    const queue = createMongoJobQueue({
      db: () => db,
      collections: { jobs: 'itest_legacy_jobs', schedules: 'itest_legacy_schedules' }
    });
    const job = await queue.getJob([7], 'schedule:7:digest:1');

    expect(job?.target).toEqual({ kind: 'action', name: 'digest', trigger: 'schedule' });
    expect(job).not.toHaveProperty('actionId');
    expect(await jobs.indexExists('spaceId_1_actionId_1_updatedAt_-1')).toBe(false);
    expect((await queue.listJobs({ spaceIds: [7], name: 'digest', limit: 5, offset: 0 })).total).toBe(1);
  });

  it('starts on a database that has no queue yet', async () => {
    await db
      .collection('itest_fresh_jobs')
      .drop()
      .catch(() => undefined);
    const queue = createMongoJobQueue({
      db: () => db,
      collections: { jobs: 'itest_fresh_jobs', schedules: 'itest_fresh_schedules' }
    });

    expect(await queue.listJobs({ spaceIds: [7], limit: 5, offset: 0 })).toEqual({ jobs: [], total: 0 });
  });
});
