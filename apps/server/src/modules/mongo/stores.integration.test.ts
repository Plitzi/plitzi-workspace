import { MongoClient } from 'mongodb';
import { afterAll, describe, expect, it } from 'vitest';

import { createMongoJobQueue } from './jobQueue';
import { createMongoKv } from './kv';
import { describeJobQueue, describeKv } from '../actions/jobs/tests/jobQueueContract';
import { leftByGoneRun, runName } from '../tests/runNames';

/**
 * The Mongo helpers against a real Mongo, through the same contract the in-process stores keep.
 *
 * Skipped — not failed — on a machine with no Mongo: `MONGO_TEST_URL` points it at one, and the default is the port the
 * repository's docker services publish. A database of this run's own, emptied before every test.
 */
const URL = process.env.MONGO_TEST_URL ?? 'mongodb://127.0.0.1:27010';
// This run's own: two runs at once (another session, the workspace's suite beside a package's) emptied each other's
// collections mid-test. Dropped at the end — and one a run killed before its end left, at the start.
const BASE = 'sdk_server_itest';
const DATABASE = runName(BASE);

const client = new MongoClient(URL, { serverSelectionTimeoutMS: 1_500 });
const available = await client
  .connect()
  .then(() => true)
  .catch(() => false);
const db = client.db(DATABASE);

if (available) {
  const { databases } = await client.db('admin').admin().listDatabases({ nameOnly: true });
  const gone = databases.map(each => each.name).filter(name => leftByGoneRun(name, BASE));
  for (const name of gone) {
    await client.db(name).dropDatabase();
  }

  if (gone.length > 0) {
    console.log(`[itest] dropped what runs killed before their end left: ${gone.join(', ')}`);
  }
}

afterAll(async () => {
  if (available) {
    await db.dropDatabase();
  }

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
