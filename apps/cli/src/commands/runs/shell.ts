import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stripVTControlCharacters } from 'node:util';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { failedSteps } from './text';
import { projectChecks } from '../../runs/checks';
import { writtenByAnother } from '../../runs/compat';
import { COPY_TASK_FILE, copyOf, runPaths, taskPaths } from '../../runs/paths';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns } from '../../runs/run';
import { readOwner } from '../../runs/taskStore';
import { isQuality } from '../../runs/team';
import { CLI_VERSION } from '../../scaffold/project';
import { findProject } from '../existingProject';

import type { RunContext } from '../../runs/run';

/**
 * What every run and task command shares: who calls — the project it is run in, the copy and its task, the token —
 * which run, and `act`, which answers in text or JSON and turns a refusal into its exit code.
 */

export interface RunCommandOptions {
  json?: boolean;
  /** The task's token `plitzi task take` answered; `PLITZI_TASK_TOKEN` otherwise. */
  token?: string;
  /** Who is calling, for the log: an agent's name. `PLITZI_AGENT` otherwise. */
  agent?: string;
  /** The run, when the token does not say it and the project has more than one. `PLITZI_RUN` otherwise. */
  run?: string;
  /** The level the agent was started at: handed tasks of it or below. `PLITZI_QUALITY` otherwise. */
  quality?: string;
}

/** A task's token says its run and its task: `<run>.<task>.<secret>`, so a task's commands need nothing else. */
const TOKEN = /^([a-z0-9][a-z0-9_-]*)\.([a-z0-9][a-z0-9_-]*)\.([0-9a-f]{48})$/;

/**
 * The project the command works on: the one it is run in — and, run from inside a task's copy (which has a package.json
 * of its own), the project that copy belongs to.
 */
interface Where {
  /** The project the runs are of — the project itself, also when the command runs in a task's copy. */
  root: string;
  /** Who the copy the command runs in is, as `task take` wrote it there: none outside a copy. */
  copy?: { token: string; agent: string };
}

/** Who a task's copy is, as `task take` wrote it: what a command run inside it needs no flag for. */
const copyTask = async (work: string): Promise<Where['copy']> => {
  const read: unknown = await fs
    .readFile(path.join(work, COPY_TASK_FILE), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isRecord(read) && typeof read.token === 'string' && typeof read.agent === 'string'
    ? { token: read.token, agent: read.agent }
    : undefined;
};

/** The shell's folder — refused, saying why, when it is gone: a task's copy, removed once the task was approved. */
const currentFolder = (): string => {
  try {
    return process.cwd();
  } catch {
    throw new RunRefusal(
      'not-found',
      'This shell’s folder is gone — a task’s copy is removed once the task is approved or cut. Go back to the project (cd <project>) and ask what is next: plitzi task next'
    );
  }
};

const whereAmI = async (): Promise<Where> => {
  const project = await findProject(currentFolder());
  if (!project) {
    throw new RunRefusal('not-found', 'There is no package.json here or above: run this in the project');
  }

  const inCopy = copyOf(project.root);
  if (!inCopy) {
    return { root: project.root };
  }

  const copy = await copyTask(project.root);

  return { root: inCopy.root, ...(copy ? { copy } : {}) };
};

/** A person, at a terminal of their own, typing the run's name — never an agent's shell, which has none. */
const askPerson = async (runId: string, action: string): Promise<boolean> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`${chalk.bold(`To ${action}`)}, type the run's name (${runId}): `);

    return answer.trim() === runId;
  } catch {
    // The terminal closed while asking (Ctrl-D, the input ended): not confirmed — refused as such, never a crash.
    return false;
  } finally {
    readline.close();
  }
};

/** The name a task's token was taken under: what its commands are logged as, unless the caller names itself. */
const holderName = async (root: string, token: string): Promise<string | undefined> => {
  const [, runId, taskId] = TOKEN.exec(token) ?? [];
  if (!runId || !taskId) {
    return undefined;
  }

  const owner = await readOwner(taskPaths(runPaths(root, runId), taskId)).catch(() => undefined);

  return owner?.token === token ? owner.agent : undefined;
};

/**
 * Who runs a command, and as which task: the token said (`--token`, `PLITZI_TASK_TOKEN`), or — run in a task's copy —
 * the copy's own, so an agent at work in it says neither. A token said wins over the copy's: the lead reviewing from
 * inside one is the lead.
 */
export const contextFor = async (options: RunCommandOptions): Promise<RunContext> => {
  const { root, copy } = await whereAmI();
  // An empty variable is none said: a shell that cleared it, not a token.
  const said = options.token ?? (process.env.PLITZI_TASK_TOKEN === '' ? undefined : process.env.PLITZI_TASK_TOKEN);
  const token = said ?? copy?.token;
  const quality = options.quality ?? process.env.PLITZI_QUALITY;
  if (quality !== undefined && quality !== '' && !isQuality(quality)) {
    throw new RunRefusal('invalid', `"${quality}" is no quality: light, standard or high (--quality, PLITZI_QUALITY)`);
  }

  const agent =
    options.agent ??
    process.env.PLITZI_AGENT ??
    (token ? ((await holderName(root, token)) ?? (said ? 'agent' : copy?.agent)) : undefined) ??
    (process.stdin.isTTY ? 'person' : 'lead');

  return {
    root,
    now: () => new Date(),
    machine: os.hostname(),
    cli: CLI_VERSION,
    ...(token ? { token } : {}),
    agent,
    ...(isQuality(quality) ? { quality } : {}),
    person: askPerson,
    checks: projectChecks
  };
};

/** The run a command is about: the token's, the one named, or the project's only active run. */
export const runOf = async (ctx: RunContext, options: RunCommandOptions, named?: string): Promise<string> => {
  const fromToken = ctx.token ? TOKEN.exec(ctx.token)?.[1] : undefined;
  const runId = named ?? options.run ?? fromToken ?? process.env.PLITZI_RUN;
  if (runId) {
    return runId;
  }

  const active = await activeRuns(ctx.root);
  if (active.length === 1) {
    return active[0];
  }

  throw new RunRefusal(
    'invalid',
    active.length === 0
      ? 'There is no open run in this project'
      : `Name the run (--run): ${active.join(', ')} are open`,
    { runs: active }
  );
};

/** The task a command is about: the token's, which a named one must match. */
export const taskOf = (ctx: RunContext, named?: string): string => {
  const fromToken = ctx.token ? TOKEN.exec(ctx.token)?.[2] : undefined;
  if (ctx.token && !fromToken) {
    throw new RunRefusal('invalid', 'That is not a task token: plitzi task take answers one');
  }

  if (named && fromToken && named !== fromToken) {
    throw new RunRefusal('invalid', `The token is task "${fromToken}"'s, not "${named}"'s`);
  }

  const task = named ?? fromToken;
  if (!task) {
    throw new RunRefusal('invalid', 'Name the task, or pass its token (--token, or PLITZI_TASK_TOKEN)');
  }

  return task;
};

/** Runs a command: its answer printed as text or JSON, a refusal as what it is and what to do next, with its exit code. */
export const act = async <T>(
  options: RunCommandOptions,
  work: (ctx: RunContext) => Promise<T>,
  text: (result: T) => string,
  exitCode: number | ((result: T) => number) = 0
): Promise<void> => {
  try {
    const ctx = await contextFor(options);
    const result = await work(ctx);
    // With --json an agent reads the data, and the sentence a person would read with it: what it means, what is next.
    console.log(
      options.json
        ? JSON.stringify(isRecord(result) ? { ...result, said: stripVTControlCharacters(text(result)) } : result)
        : text(result)
    );
    const code = typeof exitCode === 'number' ? exitCode : exitCode(result);
    if (code !== 0) {
      process.exitCode = code;
    }
  } catch (caught) {
    if (!isRunRefusal(caught)) {
      throw caught;
    }

    // A run's file another CLI wrote, not read by this one: said as that, with the CLI to go on with.
    const root = await whereAmI()
      .then(where => where.root)
      .catch(() => undefined);
    const error = (root === undefined ? undefined : await writtenByAnother(caught, root, CLI_VERSION)) ?? caught;
    if (options.json) {
      console.log(JSON.stringify(error.toJSON()));
    } else {
      console.error(`${chalk.red(`Refused (${error.code}):`)} ${error.message}\n  ${chalk.dim(`Next: ${error.next}`)}`);
      // A plan's refusal says its problems in its message already: each said once.
      error.detail.problems
        ?.filter(problem => !error.message.includes(problem))
        .forEach(problem => console.error(`  - ${problem}`));
      failedSteps(error.detail.steps).forEach(step => {
        console.error(`  ${chalk.red('✗')} ${step.name}`);
        step.said?.forEach(line => console.error(`    ${line}`));
      });
    }

    process.exitCode = error.exitCode;
  }
};

/** This CLI as a child process, in `cwd`: what a lead's one command runs several of, each as it would by hand. */
export const runSelf = (cwd: string, args: string[]): Promise<{ code: number; output: string }> =>
  new Promise(resolve => {
    const child = spawn(process.execPath, [process.argv[1], ...args], { cwd, env: process.env });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });

/** The prelude every holder's command shares: the run and the task, from the token. */
export const holder = async (
  ctx: RunContext,
  options: RunCommandOptions
): Promise<{ runId: string; taskId: string }> => ({
  runId: await runOf(ctx, options),
  taskId: taskOf(ctx)
});

/** For a task's holder or the lead: the token's task, else the one named. */
export const either = async (
  ctx: RunContext,
  options: RunCommandOptions,
  named?: string
): Promise<{ runId: string; taskId: string }> => ({ runId: await runOf(ctx, options), taskId: taskOf(ctx, named) });
