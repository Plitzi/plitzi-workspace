/** Job queue and key/value helpers for a deployment that runs Mongo. Import them as `@plitzi/sdk-server/mongo`.
 *
 *  The scheduler and the workers are the package's; WHERE the jobs wait is the deployment's — `action.jobs.queue`
 *  and `action.kv` are adapters, and the defaults keep everything in one process's memory. That is right for one
 *  replica and wrong for two: each gets its own copy of every schedule, and the jobs a replica was holding go with it
 *  when it stops. These are those adapters, already written for Mongo, over a database the deployment connects to
 *  and owns:
 *
 *  ```ts
 *  import { MongoClient } from 'mongodb';
 *  import { createServer } from '@plitzi/sdk-server';
 *  import { createMongoJobQueue, createMongoKv } from '@plitzi/sdk-server/mongo';
 *
 *  const db = new MongoClient(process.env.MONGO_URL).db('app');
 *
 *  createServer({
 *    adapters,
 *    action: { lookups, kv: createMongoKv({ db }), jobs: { queue: createMongoJobQueue({ db }) } }
 *  });
 *  ```
 *
 *  The package holds no connection and keeps no data of its own: it creates the indexes its queries need, in the
 *  collections it is told to use. `mongodb` is an optional peer dependency, used for its types alone. */

export { createMongoJobQueue, createMongoKv } from './modules/mongo';

export type { MongoDbSource, MongoJobQueue, MongoJobQueueOptions, MongoKvOptions } from './modules/mongo';
