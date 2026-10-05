/** A key/value store in a SQLite file, for a deployment with no database. Import it as `@plitzi/sdk-server/sqlite`.
 *
 *  What server actions keep in `kv` — saved layouts, counters, the single-flight keys a run guard takes — lives in one
 *  process's memory by default, and goes with it. `createFileKv` (`@plitzi/sdk-server/actions`) keeps it in a JSON
 *  file for ONE process; this keeps it in SQLite, which every process on the file shares safely:
 *
 *  ```ts
 *  import { createServer } from '@plitzi/sdk-server';
 *  import { createSqliteKv } from '@plitzi/sdk-server/sqlite';
 *
 *  createServer({ adapters, action: { lookups, kv: createSqliteKv({ file: 'data/kv.sqlite' }) } });
 *  ```
 *
 *  Its own entry because it loads `node:sqlite`, which needs Node 22.13 or later and prints an `ExperimentalWarning`
 *  when it loads: a deployment that does not use it never loads it. */

export { createSqliteKv } from './modules/sqlite/kv';

export type { SqliteKvOptions } from './modules/sqlite/kv';
