import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { connectToSpace } from './account';
import { sayDryRun } from './dryRun';
import { projectHere } from './existingProject';
import { keepSource } from './keepSource';
import { fail } from './terminal';
import { authorizedRequest } from '../account/session';
import { packSource } from '../pack/source';
import { RUNTIME_ENTRY } from '../scaffold/paths';

import type { AccountOptions } from './account';
import type { DryRunOptions } from './dryRun';
import type { PushOutcome } from './pushOutcome';
import type { ConnectedSpace, Connection } from '../account/connection';

/**
 * `plitzi runtime push | status | vars`: a space's runtime — its own server code, run as a process of its own beside
 * the platform (`@plitzi/sdk-server/runtime`) — pushed from the project that holds it, and the variables it starts with.
 *
 * The code is packed with the project's own `@plitzi/sdk-server`, at the version the project runs: what the platform
 * runs is what the project would have run itself.
 */

export interface RuntimeStatusOptions extends AccountOptions {
  json?: boolean;
}

export interface RuntimeOptions extends AccountOptions, DryRunOptions {
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
  size: string;
  stoppedReason?: 'idle' | 'manual';
  idleStopsAt?: number;
};

/** A size a runtime may run at, and whether the space's plan includes it. */
type Size = { name: string; label: string; cpu: string; memory: string; included: boolean };

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

export const DEFAULT_RUNTIME_ENTRY = RUNTIME_ENTRY;

/**
 * The project's runtime module packed and kept as the draft runtime of the space the connection works in — which a
 * publish takes live — with the source it was packed from beside it.
 */
export const pushRuntimeOf = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  entry: string,
  { dryRun = false }: DryRunOptions = {}
): Promise<PushOutcome> => {
  try {
    await fs.access(entry);
  } catch {
    fail(`There is no ${path.relative(root, entry)}: the module whose default export is defineRuntime({ start }).`);

    return 'failed';
  }

  const packer = await projectPacker(root);
  if (!packer) {
    return 'failed';
  }

  let bytes: Uint8Array;
  try {
    bytes = await packer.packRuntime(entry);
  } catch (error) {
    fail(`It does not pack: ${error instanceof Error ? error.message : String(error)}`);

    return 'failed';
  }

  if (dryRun) {
    sayDryRun(`plitzi runtime push — to ${space.name}’s draft`, [
      `→ ${path.relative(root, entry)}, packed: ${(bytes.byteLength / 1024).toFixed(0)} KB, and the source it was packed from`
    ]);

    return 'shown';
  }

  const answered = await authorizedRequest<{ ok?: boolean; digest?: string; size?: number; error?: string }>(
    connection,
    `/spaces/${String(space.id)}/runtime`,
    { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(bytes) }
  );
  if (!answered.ok) {
    fail(answered.error);

    return 'failed';
  }

  const { reply } = answered.value;
  if (reply.status !== 200 || !reply.data.digest) {
    fail(reply.data.error ?? `The runtime was not kept (${String(reply.status)}).`);

    return 'failed';
  }

  console.log(
    chalk.green(
      `${space.name}’s draft runtime is ${reply.data.digest.slice(0, 12)} (${(bytes.byteLength / 1024).toFixed(0)} KB).`
    ) + chalk.dim(' It starts in a moment; publish the space to take it live.')
  );

  // Its source beside it (docs/en/projects-from-spaces.md): what it was packed from, so the space can be taken back out as a project.
  try {
    const source = await packSource({ root, kind: 'runtime', name: 'runtime', entries: [entry] });
    await keepSource(answered.value.connection, space.id, source.bytes);
  } catch (error) {
    console.log(chalk.yellow('  Its source is not kept, so a project taken from the space gets it built only:'));
    console.log(chalk.yellow(`  ${error instanceof Error ? error.message : String(error)}`));
  }

  return 'pushed';
};

/** Packs the project's runtime module and keeps it as the space's draft runtime — which a publish takes live. */
export const pushRuntime = async (options: RuntimeOptions): Promise<void> => {
  const root = (await projectHere('whose runtime to push'))?.root;
  const connection = root && (await connectToSpace(options, 'to push to'));
  if (!root || !connection || !connection.space) {
    return;
  }

  await pushRuntimeOf(root, connection, connection.space, path.resolve(root, options.entry ?? DEFAULT_RUNTIME_ENTRY), {
    dryRun: options.dryRun
  });
};

const readRuntime = async (
  connection: Connection,
  spaceId: number
): Promise<{ environments: Environment[]; variables: string[]; sizes: Size[] } | undefined> => {
  const answered = await authorizedRequest<{
    environments?: Environment[];
    variables?: string[];
    sizes?: Size[];
    error?: string;
  }>(connection, `/spaces/${String(spaceId)}/runtime`);
  if (!answered.ok) {
    fail(answered.error);

    return undefined;
  }

  const { reply } = answered.value;
  if (reply.status !== 200) {
    fail(reply.data.error ?? `Could not read the runtime (${String(reply.status)}).`);

    return undefined;
  }

  return {
    environments: reply.data.environments ?? [],
    variables: reply.data.variables ?? [],
    sizes: reply.data.sizes ?? []
  };
};

/** How each environment's runtime is, and the names of its variables. */
export const runtimeStatus = async (options: RuntimeStatusOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to read');
  if (!connection?.space) {
    return;
  }

  const runtime = await readRuntime(connection, connection.space.id);
  if (!runtime) {
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ space: { id: connection.space.id, name: connection.space.name }, ...runtime }));

    return;
  }

  if (!runtime.environments.length) {
    console.log(`${connection.space.name} has no runtime. Push one: plitzi runtime push.`);
  }

  const spendOf = (name: string): string => {
    const size = runtime.sizes.find(option => option.name === name);

    return size ? `${size.label}, ${size.cpu} CPU / ${size.memory}` : name;
  };
  runtime.environments.forEach(({ environment, revision, digest, status, error, endpoints, tasks, size, ...rest }) => {
    const version = revision === 0 ? 'draft' : `revision ${String(revision)}`;
    console.log(`${chalk.bold(environment)} (${version}, ${digest.slice(0, 12)}): ${status} — ${spendOf(size)}`);
    if (status === 'stopped') {
      const why = rest.stoppedReason === 'idle' ? 'unused for too long' : 'stopped by hand';
      console.log(
        `  ${chalk.yellow(`Stopped (${why}): plitzi runtime start${environment === 'main' ? '' : ` --environment ${environment}`}`)}`
      );
    }

    if (rest.idleStopsAt) {
      console.log(`  Stops by itself on ${new Date(rest.idleStopsAt * 1000).toLocaleString()} if nothing uses it`);
    }

    if (error) {
      console.log(`  ${chalk.red(error)}`);
    }

    if (status === 'ready') {
      console.log(`  ${String(tasks.length)} tasks${endpoints.length ? `, answers ${endpoints.join(', ')}` : ''}`);
    }
  });
  console.log(`Variables: ${runtime.variables.length ? runtime.variables.join(', ') : 'none'}`);
  const included = runtime.sizes.filter(option => option.included).map(option => option.name);
  console.log(`Sizes in this plan: ${included.length ? included.join(', ') : 'none'}`);
};

/** Starts an environment's runtime again, or stops it — kept stopped until started. */
export const powerRuntime = async (power: 'start' | 'stop', options: RuntimeOptions & { environment?: string }) => {
  const connection = await connectToSpace(options, 'to configure');
  if (!connection?.space) {
    return;
  }

  const environment = options.environment ?? 'main';
  if (options.dryRun) {
    sayDryRun(`plitzi runtime ${power} — ${connection.space.name}`, [`${power} ${environment}’s runtime`]);

    return;
  }

  const answered = await authorizedRequest<{ error?: string }>(
    connection,
    `/spaces/${String(connection.space.id)}/runtime/${power}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ environment }) }
  );
  if (!answered.ok) {
    fail(answered.error);

    return;
  }

  const { reply } = answered.value;
  if (reply.status !== 204) {
    fail(
      reply.data.error ?? `The runtime was not ${power === 'start' ? 'started' : 'stopped'} (${String(reply.status)}).`
    );

    return;
  }

  console.log(
    chalk.green(
      `${environment} ${power === 'start' ? 'starts in a moment' : 'stops, and stays stopped until started'}.`
    )
  );
};

/** Chooses the size an environment's runtime runs at — one the space's plan includes — and it starts again at it. */
export const setRuntimeSize = async (size: string, options: RuntimeOptions & { environment?: string }) => {
  const connection = await connectToSpace(options, 'to configure');
  if (!connection?.space) {
    return;
  }

  const environment = options.environment ?? 'main';
  if (options.dryRun) {
    sayDryRun(`plitzi runtime size — ${connection.space.name}`, [
      `${environment}’s runtime at ${size}, started again at it`
    ]);

    return;
  }

  const answered = await authorizedRequest<{ error?: string }>(
    connection,
    `/spaces/${String(connection.space.id)}/runtime/size`,
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size, environment }) }
  );
  if (!answered.ok) {
    fail(answered.error);

    return;
  }

  const { reply } = answered.value;
  if (reply.status !== 204) {
    fail(reply.data.error ?? `The size was not changed (${String(reply.status)}).`);

    return;
  }

  console.log(chalk.green(`${environment} runs at ${size} — the runtime starts again at it.`));
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
export const setRuntimeVariable = async (name: string, value: string | undefined, options: RuntimeOptions) => {
  const connection = await connectToSpace(options, 'to configure');
  if (!connection?.space) {
    return;
  }

  // Never read, not even from standard input: a dry run says what would be set, and holds no secret.
  if (options.dryRun) {
    sayDryRun(`plitzi runtime vars set — ${connection.space.name}`, [
      `${name}, ${value === undefined ? 'its value read from standard input' : 'to the value given'} — the runtime started again with it`
    ]);

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

  console.log(chalk.green(`${name} set — the runtime starts again with it.`));
};

export const unsetRuntimeVariable = async (name: string, options: RuntimeOptions) => {
  const connection = await connectToSpace(options, 'to configure');
  if (!connection?.space) {
    return;
  }

  if (options.dryRun) {
    sayDryRun(`plitzi runtime vars unset — ${connection.space.name}`, [
      `${name} removed — the runtime started again without it`
    ]);

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

  console.log(chalk.green(`${name} removed — the runtime starts again without it.`));
};
