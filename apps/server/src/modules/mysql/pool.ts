import type { MysqlConfig } from './config';
import type { Pool, PoolOptions } from 'mysql2/promise';

type Driver = typeof import('mysql2/promise');

let driver: Driver | undefined;

/**
 * `mysql2` is an OPTIONAL peer dependency: this is the only module in the package that speaks to a database, and a
 * deployment bringing its own store should not download a driver to find that out. Loaded dynamically so its absence
 * is a sentence rather than a bare `ERR_MODULE_NOT_FOUND` from a file the reader has never heard of.
 */
const loadDriver = async (): Promise<Driver> => {
  if (driver) {
    return driver;
  }

  try {
    driver = await import('mysql2/promise');
  } catch {
    throw new Error(
      '@plitzi/sdk-server/mysql needs the `mysql2` driver, which is not installed. Add it with `yarn add mysql2` ' +
        '(or `npm install mysql2`). It is an optional peer dependency so that a deployment bringing its own ' +
        'account store never downloads a database driver it does not use.'
    );
  }

  return driver;
};

/**
 * The configured connection string, as the driver wants it.
 *
 * Parsed rather than handed to `createPool` as `uri`, and that is not a style choice: **that option is ignored** —
 * only `createPool(uriString)` reads a URL, and that form takes no options. Passing both silently drops the URL and
 * connects to the driver's own defaults, which on a machine that happens to run MySQL locally is a connection to
 * the wrong database rather than an error. Anything unparseable is refused here, where the message can say so.
 */
const fromUrl = (url: string): PoolOptions => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('@plitzi/sdk-server/mysql: `url` is not a valid database URL');
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (!parsed.hostname) {
    throw new Error('@plitzi/sdk-server/mysql: `url` names no host');
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database
  };
};

export const createPool = async (config: MysqlConfig): Promise<Pool> => {
  if (config.pool) {
    return config.pool;
  }

  const { url, host, port, user, password, database, ssl, connectionLimit = 10 } = config;
  const base = url ? fromUrl(url) : {};

  const options: PoolOptions = {
    ...base,
    ...(host !== undefined ? { host } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(user !== undefined ? { user } : {}),
    ...(password !== undefined ? { password } : {}),
    ...(database !== undefined ? { database } : {}),
    ...(ssl !== undefined ? { ssl } : {}),
    connectionLimit,
    // Unix seconds go in and come back out as numbers. Without this the driver hands back `Date` objects for
    // DATETIME columns and strings for BIGINT ones, and every expiry comparison in the kernel is against a number.
    supportBigNumbers: true,
    bigNumberStrings: false,
    // A query that cannot get a connection must say so rather than hang: the pool exhausting itself and the database
    // being unreachable look identical to a caller that waits forever.
    waitForConnections: true,
    queueLimit: 0
  };

  if (!options.database) {
    throw new Error(
      '@plitzi/sdk-server/mysql: no database was given. Pass `database`, or a `url` that ends in one — ' +
        'a connection with no database selected fails later, on the first query, as a much less obvious error.'
    );
  }

  const mysql = await loadDriver();

  if (config.ensureDatabase) {
    await createDatabase(mysql, options);
  }

  return mysql.createPool(options);
};

/**
 * A database name cannot be a bound parameter — it is an identifier, not a value — so it is quoted by hand, and
 * anything that could end the quoting is refused rather than escaped. The set of legal MySQL database names is
 * small and this is all of it.
 */
const quoteDatabase = (name: string): string => {
  if (!/^[A-Za-z0-9_$]+$/.test(name)) {
    throw new Error(
      `@plitzi/sdk-server/mysql: "${name}" is not a database name that can be created safely. Use letters, ` +
        'digits, underscores and dollar signs, or create the database yourself and leave `ensureDatabase` off.'
    );
  }

  return `\`${name}\``;
};

/** Connects to the SERVER rather than to the database, which is the only way to ask for one that is not there. */
const createDatabase = async (mysql: Driver, options: PoolOptions): Promise<void> => {
  const { database, ...server } = options;
  const name = quoteDatabase(database ?? '');
  const connection = await mysql.createConnection(server);

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (error: unknown) {
    // The common case, and the one whose own message explains nothing: an application user is usually granted
    // rights on one database and no right to make another. Which is correct — so say what to do about it rather
    // than restating the refusal.
    if ((error as { code?: string }).code === 'ER_DBACCESS_DENIED_ERROR') {
      throw new Error(
        `@plitzi/sdk-server/mysql: the user "${String(options.user)}" may not create the database ${name}. ` +
          `Create it once as an administrator — CREATE DATABASE ${name} CHARACTER SET utf8mb4 COLLATE ` +
          'utf8mb4_unicode_ci; — and grant that user rights on it, then turn `ensureDatabase` off. Creating ' +
          'databases is not a right an application should hold in the first place.',
        { cause: error }
      );
    }

    throw error;
  } finally {
    await connection.end();
  }
};
