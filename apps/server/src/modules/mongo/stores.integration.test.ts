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

describe.skipIf(!available)('mongo — a queue on a database that has none', () => {
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
