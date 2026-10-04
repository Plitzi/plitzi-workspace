import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import chalk from 'chalk';

import { readFunctionsSource } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { connectToSpace } from './account';
import { projectHere } from './existingProject';
import { fail } from './terminal';
import { authorizedRequest } from '../account/session';

import type { AccountOptions } from './account';
import type { PushOutcome } from './pushOutcome';
import type { ConnectedSpace, Connection } from '../account/connection';

/**
 * `plitzi functions pull | push | try`: a space's functions — its own server code — edited in a project.
 *
 * The project's `functions/` is a WORKING COPY of the space's source, never a second source: pull writes the space's
 * files into it, push sends them back and is refused when the space's copy moved on since the pull, so neither the
 * builder nor a project silently undoes the other. What was pulled is kept in `.plitzi/functions.json` — the version the
 * platform gave and the files as they were — which is how a pull knows it would overwrite something not pushed yet.
 */

export interface FunctionsOptions extends AccountOptions {
  force?: boolean;
  params?: string;
}

const FUNCTIONS_DIR = 'functions';
const STATE_FILE = path.join('.plitzi', 'functions.json');

type Files = Record<string, string>;
/** What `functions pull` last wrote into `functions/`, and the version of the space's functions it was. */
export type WorkingCopy = { space: number; version: string; files: Files };
type Draft = { files: Files; version: string; manifest: { tasks: { namespace: string; action: string }[] } | null };
type Problem = { file?: string; line?: number; column?: number; message: string };

/** The project's root: where `functions/` and `.plitzi/` go. Undefined — said — outside a project. */
const rootOf = async (): Promise<string | undefined> => (await projectHere('whose functions these are'))?.root;

/** Every source file under `functions/`, by its path there — read by the one rule of what a source is. */
const readLocal = (root: string): Promise<Files> =>
  readFunctionsSource(path.join(root, FUNCTIONS_DIR), {
    list: async dir =>
      (await fs.readdir(dir, { withFileTypes: true })).map(entry => ({
        name: entry.name,
        directory: entry.isDirectory()
      })),
    read: file => fs.readFile(file, 'utf8')
  });

const readState = async (root: string): Promise<WorkingCopy | undefined> => {
  try {
    const value: unknown = JSON.parse(await fs.readFile(path.join(root, STATE_FILE), 'utf8'));
    if (
      !isRecord(value) ||
      typeof value.space !== 'number' ||
      typeof value.version !== 'string' ||
      !isRecord(value.files)
    ) {
      return undefined;
    }

    const files = Object.fromEntries(
      Object.entries(value.files).flatMap(([name, text]) => (typeof text === 'string' ? [[name, text]] : []))
    );

    return { space: value.space, version: value.version, files };
  } catch {
    return undefined;
  }
};

export const writeFunctionsState = async (root: string, state: WorkingCopy): Promise<void> => {
  await fs.mkdir(path.join(root, '.plitzi'), { recursive: true });
  await fs.writeFile(path.join(root, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
};

/** The files that differ between two copies — added, removed or changed — sorted. */
const changedFiles = (a: Files, b: Files): string[] =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(file => a[file] !== b[file]).sort();

/**
 * What `functions/` holds that the space does not: nothing at all (`none`, no `functions/index.ts`), something changed
 * since it was pulled from this space or never pulled (`changed`), or exactly what was pulled (`unchanged`).
 */
export const functionsChange = async (root: string, spaceId: number): Promise<'none' | 'changed' | 'unchanged'> => {
  const [local, state] = await Promise.all([readLocal(root), readState(root)]);
  if (!Object.hasOwn(local, 'index.ts')) {
    return 'none';
  }

  return state?.space === spaceId && !changedFiles(local, state.files).length ? 'unchanged' : 'changed';
};

const taskList = (draft: Pick<Draft, 'manifest'>): string =>
  draft.manifest?.tasks.length
    ? draft.manifest.tasks.map(task => `${task.namespace}.${task.action}`).join(', ')
    : 'no tasks';

const readDraft = async (connection: Connection, spaceId: number): Promise<Draft | undefined> => {
  const answered = await authorizedRequest<Draft & { error?: string }>(connection, `/spaces/${spaceId}/functions`);
  if (!answered.ok) {
    fail(answered.error);

    return undefined;
  }

  const { reply } = answered.value;
  if (reply.status !== 200) {
    fail(reply.data.error ?? `Could not read the space’s functions (${reply.status}).`);

    return undefined;
  }

  return reply.data;
};

export const pullFunctions = async (options: FunctionsOptions): Promise<void> => {
  const root = await rootOf();
  const connection = root && (await connectToSpace(options, 'to pull from'));
  if (!root || !connection || !connection.space) {
    return;
  }

  const [local, state] = await Promise.all([readLocal(root), readState(root)]);
  const unpushed = state ? changedFiles(local, state.files) : Object.keys(local);
  if (!options.force && (state?.space ?? connection.space.id) !== connection.space.id) {
    fail('functions/ is a copy of another space’s. Pull into another project, or pass --force to replace it.');

    return;
  }

  if (!options.force && unpushed.length) {
    fail(
      `Pulling would overwrite what is not pushed yet: ${unpushed.join(', ')}.\n` +
        'Push it first, or pass --force to throw it away.'
    );

    return;
  }

  const draft = await readDraft(connection, connection.space.id);
  if (!draft) {
    return;
  }

  const base = path.join(root, FUNCTIONS_DIR);
  await Promise.all(
    Object.keys(local)
      .filter(file => !Object.hasOwn(draft.files, file))
      .map(file => fs.rm(path.join(base, file)))
  );
  for (const [file, text] of Object.entries(draft.files)) {
    await fs.mkdir(path.dirname(path.join(base, file)), { recursive: true });
    await fs.writeFile(path.join(base, file), text);
  }

  await writeFunctionsState(root, { space: connection.space.id, version: draft.version, files: draft.files });
  const count = Object.keys(draft.files).length;
  console.log(
    count
      ? chalk.green(
          `Pulled ${count} file${count === 1 ? '' : 's'} of ${connection.space.name}’s functions into functions/ — ${taskList(draft)}.`
        )
      : `${chalk.bold(connection.space.name)} has no functions yet. Write functions/index.ts and plitzi functions push.`
  );
};

const printProblems = (problems: Problem[]): void => {
  console.error(chalk.red('The functions were not saved:'));
  problems.forEach(({ file, line, column, message }) => {
    const where = file
      ? `functions/${file}${line ? `:${String(line)}${column ? `:${String(column)}` : ''}` : ''}`
      : 'functions';
    console.error(`  ${chalk.bold(where)} ${message}`);
  });
  process.exitCode = 1;
};

/**
 * `functions/` saved as the draft of the space the connection works in: refused when the space's copy moved on since the
 * pull, and — for a project that never pulled them — when the space already has functions of its own. `force` replaces
 * whatever the space holds now, which is what `plitzi push --force` asks of every part.
 */
export const pushFunctionsOf = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  { force = false }: { force?: boolean } = {}
): Promise<PushOutcome> => {
  const [local, state] = await Promise.all([readLocal(root), readState(root)]);
  if (!Object.hasOwn(local, 'index.ts')) {
    fail('There is no functions/index.ts here: it is where a space’s functions start. Pull them, or write it.');

    return 'failed';
  }

  if (state?.space === space.id && !changedFiles(local, state.files).length) {
    return 'unchanged';
  }

  // A copy of another space's, or none at all: only an empty space may be pushed to without pulling first.
  let base = state?.space === space.id && !force ? state.version : undefined;
  if (base === undefined) {
    const draft = await readDraft(connection, space.id);
    if (!draft) {
      return 'failed';
    }

    if (Object.keys(draft.files).length && !force) {
      fail(`${space.name} already has functions. Pull them first: plitzi functions pull.`);

      return 'failed';
    }

    base = draft.version;
  }

  const answered = await authorizedRequest<{
    ok: boolean;
    version?: string;
    manifest?: Draft['manifest'];
    problems?: Problem[];
    refusal?: { error: string };
    error?: string;
  }>(connection, `/spaces/${space.id}/functions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: local, base })
  });
  if (!answered.ok) {
    fail(answered.error);

    return 'failed';
  }

  const { reply } = answered.value;
  if (reply.status === 422 && reply.data.problems) {
    printProblems(reply.data.problems);

    return 'failed';
  }

  if (reply.status === 409) {
    fail(
      `${space.name}’s functions changed since your pull — in the builder, or from another copy. ` +
        'Keep your changes aside, pull, and apply them again.'
    );

    return 'failed';
  }

  if (reply.status !== 200 || !reply.data.version) {
    fail(reply.data.refusal?.error ?? reply.data.error ?? `The functions were not saved (${reply.status}).`);

    return 'failed';
  }

  await writeFunctionsState(root, { space: space.id, version: reply.data.version, files: local });
  console.log(
    chalk.green(`Functions pushed to ${space.name}’s draft — ${taskList({ manifest: reply.data.manifest ?? null })}.`)
  );

  return 'pushed';
};

export const pushFunctions = async (options: FunctionsOptions): Promise<void> => {
  const root = await rootOf();
  const connection = root && (await connectToSpace(options, 'to push to'));
  if (!root || !connection || !connection.space) {
    return;
  }

  const outcome = await pushFunctionsOf(root, connection, connection.space);
  if (outcome === 'unchanged') {
    console.log('Nothing to push: functions/ is what was pulled.');
  } else if (outcome === 'pushed') {
    console.log(chalk.dim('The live site runs them once the space is published.'));
  }
};

type RunReport = {
  status?: string;
  output?: { value?: unknown };
  steps?: { action: string; error?: string; logs?: string[]; startTime: number; endTime: number }[];
};

/** What one run of a task did: its logs, then its value — or why it failed, as a failure of the command. */
const printRun = (task: string, report: RunReport): void => {
  const step = report.steps?.find(entry => entry.action === task);
  const took = step ? `${String(step.endTime - step.startTime)} ms` : '';
  step?.logs?.forEach(line => console.log(chalk.dim(`log  ${line}`)));
  if (step?.error) {
    fail(`${task} failed after ${took}: ${step.error}`);

    return;
  }

  console.log(`${chalk.green(report.status ?? 'completed')} ${chalk.dim(took ? `in ${took}` : '')}`);
  console.log(JSON.stringify(report.output?.value ?? null, null, 2));
};

/** `--params`, read: an object of the task's params by name, or nothing when it is not one. */
const paramsOf = (given: string | undefined): Record<string, unknown> | undefined => {
  try {
    const params: unknown = given ? JSON.parse(given) : {};
    if (isRecord(params)) {
      return params;
    }
  } catch {
    // Said below, the same as a value that parsed but is not an object.
  }

  fail('--params is a JSON object of the task’s params, by name: --params \'{"name":"Ada"}\'');

  return undefined;
};

export const tryFunction = async (task: string, options: FunctionsOptions): Promise<void> => {
  const params = paramsOf(options.params);
  if (!params) {
    return;
  }

  const connection = await connectToSpace(options, 'to try it in');
  if (!connection?.space) {
    return;
  }

  const answered = await authorizedRequest<RunReport & { error?: string }>(
    connection,
    `/spaces/${connection.space.id}/functions/try`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, params })
    }
  );
  if (!answered.ok) {
    fail(answered.error);

    return;
  }

  const { reply } = answered.value;
  if (reply.status !== 200) {
    fail(reply.data.error ?? `The task could not be tried (${reply.status}).`);

    return;
  }

  printRun(task, reply.data);
};

/** The part of this project's `@plitzi/sdk-server/functions-runner` that `dev` uses — read, since it is the project's. */
type LocalFunctions = {
  load: (source: Files) => Promise<{ ok: true; tasks: string[] } | { ok: false; problems: Problem[] }>;
  tryTask: (task: string, params: Record<string, unknown>) => Promise<RunReport>;
};

type LocalRunner = {
  createLocalFunctions: (options: { credentials?: Record<string, Record<string, string>> }) => LocalFunctions;
};

const isLocalRunner = (value: unknown): value is LocalRunner =>
  isRecord(value) && typeof value.createLocalFunctions === 'function';

/**
 * This project's own runner: `dev` runs the functions with the `@plitzi/sdk-server` the project installed, so the build,
 * the checks, the isolates and the limits are the platform's own, at the version the project is on.
 */
const projectRunner = async (root: string): Promise<LocalRunner | undefined> => {
  try {
    const entry = createRequire(path.join(root, 'package.json')).resolve('@plitzi/sdk-server/functions-runner');
    const loaded: unknown = await import(pathToFileURL(entry).href);
    if (isLocalRunner(loaded)) {
      return loaded;
    }
  } catch {
    // Said below: the one way to have it is to install it.
  }

  fail(
    'plitzi functions dev runs them with this project’s own @plitzi/sdk-server, and the isolates it needs:\n' +
      '  npm install --save-dev @plitzi/sdk-server isolated-vm core-js'
  );

  return undefined;
};

/** `PLITZI_FUNCTIONS_CREDENTIALS`, a JSON object of credential id → its keys: what `ctx.fetch` may name locally. */
const localCredentials = (): Record<string, Record<string, string>> => {
  const raw = process.env.PLITZI_FUNCTIONS_CREDENTIALS;
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};

    return isRecord(value)
      ? Object.fromEntries(
          Object.entries(value).flatMap(([id, keys]) =>
            isRecord(keys)
              ? [
                  [
                    id,
                    Object.fromEntries(
                      Object.entries(keys).filter((pair): pair is [string, string] => typeof pair[1] === 'string')
                    )
                  ]
                ]
              : []
          )
        )
      : {};
  } catch {
    return {};
  }
};

export interface FunctionsDevOptions {
  params?: string;
  watch?: boolean;
}

const NO_NODE_SNAPSHOT = '--no-node-snapshot';

/**
 * The isolates `dev` runs need Node's startup snapshot off, and a process cannot turn it off once started: `dev` runs
 * itself again with it, and answers with that run's exit code.
 */
const rerunWithoutNodeSnapshot = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...process.execArgv, NO_NODE_SNAPSHOT, ...process.argv.slice(1)], {
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', code => {
      resolve(code ?? 1);
    });
  });

/**
 * `plitzi functions dev <task>`: the task run from `functions/` on this machine, as the platform would run it — and,
 * with `--watch`, again every time a file is saved. Nothing reaches the space: its draft is what `push` sends.
 */
export const devFunction = async (task: string, options: FunctionsDevOptions): Promise<void> => {
  if (!process.execArgv.includes(NO_NODE_SNAPSHOT)) {
    process.exitCode = await rerunWithoutNodeSnapshot();

    return;
  }

  const params = paramsOf(options.params);
  const root = params && (await rootOf());
  const runner = root ? await projectRunner(root) : undefined;
  if (!root || !runner) {
    return;
  }

  const local = runner.createLocalFunctions({ credentials: localCredentials() });
  const run = async (): Promise<void> => {
    const loaded = await local.load(await readLocal(root));
    if (!loaded.ok) {
      printProblems(loaded.problems);

      return;
    }

    if (!loaded.tasks.includes(task)) {
      fail(`functions/ declares no task ${task}. It declares: ${loaded.tasks.join(', ') || 'none'}.`);

      return;
    }

    printRun(task, await local.tryTask(task, params));
  };

  await run();
  if (!options.watch) {
    return;
  }

  console.log(chalk.dim('\nWatching functions/ — every save runs it again. ^C to stop.'));
  let pending: NodeJS.Timeout | undefined;
  watch(path.join(root, FUNCTIONS_DIR), { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      process.exitCode = undefined;
      console.log(chalk.dim(`\n— ${new Date().toLocaleTimeString()}`));
      void run();
    }, 150);
  });
};
