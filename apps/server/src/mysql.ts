/** An account store on MySQL, implemented. Import it as `@plitzi/sdk-server/mysql`.
 *
 *  `@plitzi/sdk-server/auth` says what auth needs to know — the accounts, the roles, the memberships, the space
 *  credentials — and leaves answering it to the deployment, which is right for one that already has a user table
 *  and pure ceremony for one that does not. This entry is the other case: the tables, the queries and the seeding,
 *  so standing up a space with your own users is a connection string rather than a schema design.
 *
 *  ```ts
 *  import { createServer } from '@plitzi/sdk-server';
 *  import { createAuth } from '@plitzi/sdk-server/auth';
 *  import { createMysqlStore } from '@plitzi/sdk-server/mysql';
 *
 *  const store = await createMysqlStore({ url: process.env.DATABASE_URL });
 *  const auth = createAuth({ tokens: { secret, issuer }, adapters: store.authAdapters, api: store.passwords });
 *
 *  createServer({ adapters: space, auth }).listen(3000);
 *  ```
 *
 *  Its own entry, and its own optional peer dependency (`mysql2`), because it is the only part of the package that
 *  touches a database: a deployment bringing its own store neither loads a driver nor downloads one.
 *
 *  The tables are documented in `docs/auth/mysql-schema.md` — what each one is for, and what a deployment mapping
 *  its existing schema onto the adapters has to be able to answer. */

export { createMysqlStore, mysqlSchemaStatements } from './modules/mysql';
export { SCHEMA_VERSION, TABLE_NAMES, generateToken, hashPassword, tableNames, verifyPassword } from './modules/mysql';

export type {
  AccountSeed,
  MysqlAdmin,
  MysqlConfig,
  MysqlStore,
  SessionStore,
  SessionSummary,
  SpaceTokenSeed,
  TableKey,
  Tables
} from './modules/mysql';
