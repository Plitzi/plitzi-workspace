import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import chalk from 'chalk';

import { apiFor, connectionWithSpace, fail } from './account';
import { findProject } from './existingProject';
import { authorizedRequest } from '../account/session';

import type { AccountOptions } from './account';
import type { Connection } from '../account/connection';

/**
 * `plitzi runtime push | status | vars`: a space's runtime — its own server code, run as a process of its own beside
 * the platform (`@plitzi/sdk-server/runtime`) — pushed from the project that holds it, and the variables it starts with.
 *
 * The code is packed with the project's own `@plitzi/sdk-server`, at the version the project runs: what the platform
 * runs is what the project would have run itself.
 */

export interface RuntimeOptions extends AccountOptions {
  /** The runtime module: whose default export is `defineRuntime(…)`. `src/runtime.ts` by default. */
  entry?: string;
}

type Environment = {
  environment: string;
  revision: number;
  digest: string;
  status: string;
  error?: string;
  endpoints: string[];
  tasks: string[];
};

const DEFAULT_ENTRY = path.join('src', 'runtime.ts');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Packer = { packRuntime: (entry: string) => Promise<Uint8Array> };

const isPacker = (value: unknown): value is Packer => isRecord(value) && typeof value.packRuntime === 'function';

/** This project's own packer — read, since it is the project's. */
const projectPacker = async (root: string): Promise<Packer | undefined> => {
  try {
    const entry = createRequire(path.join(root, 'package.json')).resolve('@plitzi/sdk-server/runtime');
    const loaded: unknown = await import(pathToFileURL(entry).href);
    if (isPacker(loaded)) {
      return loaded;
    }
  } catch {
    // Said below: the one way to have it is to install it.
  }

  fail('plitzi runtime packs it with this project’s own @plitzi/sdk-server:\n  npm install @plitzi/sdk-server');

  return undefined;
};

const connect = async (options: AccountOptions, doing: string): Promise<Connection | undefined> => {
  const api = await apiFor(options);

  return api ? connectionWithSpace(api, doing) : undefined;
};

/** Packs the project's runtime module and keeps it as the space's draft runtime — which a publish takes live. */
export const pushRuntime = async (options: RuntimeOptions): Promise<void> => {
  const connection = await connect(options, 'to push to');
  if (!connection?.space) {
    return;
  }

  const root = (await findProject(process.cwd()))?.root ?? process.cwd();
  const entry = path.resolve(root, options.entry ?? DEFAULT_ENTRY);
  try {
    await fs.access(entry);
  } catch {
    fail(`There is no ${path.relative(root, entry)}: the module whose default export is defineRuntime({ start }).`);

    return;
  }

  const packer = await projectPacker(root);
  if (!packer) {
    return;
  }

  let bytes: Uint8Array;
  try {
    bytes = await packer.packRuntime(entry);
  } catch (error) {
    fail(`It does not pack: ${error instanceof Error ? error.message : String(error)}`);

    return;
  }

  const answered = await authorizedRequest<{ ok?: boolean; digest?: string; size?: number; error?: string }>(
    connection,
    `/spaces/${String(connection.space.id)}/runtime`,
    { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(bytes) }
  );
  if (!answered.ok) {
    fail(answered.error);

    return;
  }

  const { reply } = answered.value;
  if (reply.status !== 200 || !reply.data.digest) {
    fail(reply.data.error ?? `The runtime was not kept (${String(reply.status)}).`);

    return;
  }

  console.log(
    `${chalk.green('✓')} ${connection.space.name}’s draft runtime is ${reply.data.digest.slice(0, 12)} ` +
      `(${(bytes.byteLength / 1024).toFixed(0)} KB). It starts in a moment; publish the space to take it live.`
  );
};

const readRuntime = async (
  connection: Connection,
  spaceId: number
): Promise<{ environments: Environment[]; variables: string[] } | undefined> => {
  const answered = await authorizedRequest<{ environments?: Environment[]; variables?: string[]; error?: string }>(
    connection,
    `/spaces/${String(spaceId)}/runtime`
  );
  if (!answered.ok) {
    fail(answered.error);

    return undefined;
  }

  const { reply } = answered.value;
  if (reply.status !== 200) {
    fail(reply.data.error ?? `Could not read the runtime (${String(reply.status)}).`);

    return undefined;
  }

  return { environments: reply.data.environments ?? [], variables: reply.data.variables ?? [] };
};

/** How each environment's runtime is, and the names of its variables. */
export const runtimeStatus = async (options: AccountOptions): Promise<void> => {
  const connection = await connect(options, 'to read');
  if (!connection?.space) {
    return;
  }

  const runtime = await readRuntime(connection, connection.space.id);
  if (!runtime) {
    return;
  }

  if (!runtime.environments.length) {
    console.log(`${connection.space.name} has no runtime. Push one: plitzi runtime push.`);
  }

  runtime.environments.forEach(({ environment, revision, digest, status, error, endpoints, tasks }) => {
    const version = revision === 0 ? 'draft' : `revision ${String(revision)}`;
    console.log(`${chalk.bold(environment)} (${version}, ${digest.slice(0, 12)}): ${status}`);
    if (error) {
      console.log(`  ${chalk.red(error)}`);
    }

    if (status === 'ready') {
      console.log(`  ${String(tasks.length)} tasks${endpoints.length ? `, answers ${endpoints.join(', ')}` : ''}`);
    }
  });
  console.log(`Variables: ${runtime.variables.length ? runtime.variables.join(', ') : 'none'}`);
};

/** Everything sent on standard input: a value piped in rather than typed where the shell history keeps it. */
const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
};

/**
 * Sets one of the runtime's variables — the runtime starts again with it. Without a value it is read from standard
 * input (`printf %s "$URL" | plitzi runtime vars set REDIS_URL`), which keeps a secret out of the shell's history.
 */
export const setRuntimeVariable = async (name: string, value: string | undefined, options: AccountOptions) => {
  const connection = await connect(options, 'to configure');
  if (!connection?.space) {
    return;
  }

  const given = value ?? (await readStdin());
  const answered = await authorizedRequest<{ error?: string }>(
    connection,
    `/spaces/${String(connection.space.id)}/runtime/variables/${encodeURIComponent(name)}`,
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: given }) }
  );
  if (!answered.ok) {
    fail(answered.error);

    return;
  }

  const { reply } = answered.value;
  if (reply.status !== 204) {
    fail(reply.data.error ?? `${name} was not set (${String(reply.status)}).`);

    return;
  }

  console.log(`${chalk.green('✓')} ${name} set — the runtime starts again with it.`);
};

export const unsetRuntimeVariable = async (name: string, options: AccountOptions) => {
  const connection = await connect(options, 'to configure');
  if (!connection?.space) {
    return;
  }

  const answered = await authorizedRequest<{ error?: string }>(
    connection,
    `/spaces/${String(connection.space.id)}/runtime/variables/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
  if (!answered.ok) {
    fail(answered.error);

    return;
  }

  console.log(`${chalk.green('✓')} ${name} removed — the runtime starts again without it.`);
};
