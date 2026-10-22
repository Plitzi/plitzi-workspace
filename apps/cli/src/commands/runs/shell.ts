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
import { AGENT_TOKEN, identify, issuedText, UNNAMED } from '../../runs/identity';
import { LEAD } from '../../runs/messages';
import { COPY_TASK_FILE, copyOf, runPaths, taskPaths } from '../../runs/paths';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns } from '../../runs/run';
import { readOwner } from '../../runs/taskStore';
import { isQuality } from '../../runs/team';
import { USAGE_OFF, usageCaller } from '../../runs/usage';
import { CLI_VERSION } from '../../scaffold/project';
import { findProject } from '../existingProject';

import type { Claim } from '../../runs/identity';
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

/** What a context's caller said of itself, until the run is known and it is proved (`runOf`). */
const unproved = new WeakMap<RunContext, { claim: Claim; prove: (agent: string) => void }>();

/** What the caller brought: its own token, a task's, a name, a terminal — or nothing. */
const claimOf = async (
  root: string,
  said: { own?: string; token?: string; name?: string; fallback: string }
): Promise<Claim> => {
  const { own, token, name } = said;
  if (own !== undefined) {
    return { kind: 'agent', token: own, ...(name === undefined ? {} : { said: name }) };
  }

  if (token !== undefined) {
    const holder = await holderName(root, token);

    return {
      kind: 'task',
      ...(holder === undefined ? {} : { holder }),
      ...(name === undefined ? {} : { said: name }),
      fallback: said.fallback
    };
  }

  if (name !== undefined) {
    return { kind: 'name', said: name };
  }

  return process.stdin.isTTY ? { kind: 'person' } : { kind: 'none' };
};

/**
 * Who runs a command, and as which task: an agent by its own token (`--token`, `PLITZI_TASK_TOKEN`), a task by its
 * token — said, or its copy's, so an agent at work in it says neither — and a person by their terminal. A name said
 * alone is proved once the run is known (`runOf`): its first time, it is made a token. Read before that, `agent` is a
 * bug of the CLI's, never a guess — a guess was the lead.
 */
export const contextFor = async (options: RunCommandOptions): Promise<RunContext> => {
  const { root, copy } = await whereAmI();
  // An empty variable is none said: a shell that cleared it, not a token.
  const said = options.token ?? (process.env.PLITZI_TASK_TOKEN === '' ? undefined : process.env.PLITZI_TASK_TOKEN);
  const own = said !== undefined && AGENT_TOKEN.test(said) ? said : undefined;
  const ownName = own === undefined ? undefined : AGENT_TOKEN.exec(own)?.[2];
  const name = options.agent ?? (process.env.PLITZI_AGENT === '' ? undefined : process.env.PLITZI_AGENT);
  // The copy's token is its holder's task: kept for that holder's own token, never for another's — the lead reviewing
  // from inside a copy is the lead, holding no task.
  const token = own === undefined ? (said ?? copy?.token) : ownName === copy?.agent ? copy?.token : undefined;
  const quality = options.quality ?? process.env.PLITZI_QUALITY;
  if (quality !== undefined && quality !== '' && !isQuality(quality)) {
    throw new RunRefusal('invalid', `"${quality}" is no quality: light, standard or high (--quality, PLITZI_QUALITY)`);
  }

  const claim = await claimOf(root, {
    own,
    token,
    name,
    fallback: said === undefined ? (copy?.agent ?? 'agent') : 'agent'
  });

  let agent: string | undefined;
  const ctx: RunContext = {
    root,
    now: () => new Date(),
    machine: os.hostname(),
    cli: CLI_VERSION,
    ...(token ? { token } : {}),
    get agent(): string {
      if (agent === undefined) {
        throw new Error('A run command read who calls before it was proved (runOf): a bug of the CLI');
      }

      return agent;
    },
    ...(isQuality(quality) ? { quality } : {}),
    person: askPerson,
    checks: projectChecks,
    // On stderr, dim: never in an answer read as JSON, nor in the one sentence a command ends with.
    ...(options.json === true || process.env.PLITZI_JSON === '1'
      ? {}
      : { say: (line: string) => process.stderr.write(chalk.dim(`· ${line}\n`)) })
  };
  unproved.set(ctx, {
    claim,
    prove: proved => {
      agent = proved;
    }
  });
  if (claim.kind === 'person') {
    agent = 'person';
    unproved.delete(ctx);
  }

  return ctx;
};

/** What is proved without the run named: a token says its own run. */
const proveByToken = async (ctx: RunContext): Promise<void> => {
  const claim = unproved.get(ctx)?.claim;
  const run =
    claim?.kind === 'agent'
      ? AGENT_TOKEN.exec(claim.token)?.[1]
      : claim?.kind === 'task' && ctx.token
        ? TOKEN.exec(ctx.token)?.[1]
        : undefined;
  if (run !== undefined) {
    await prove(ctx, run);
  }
};

/** Proves who calls `ctx` on `runId`, once: a token made at an agent's first command is said to it, on stderr. */
const prove = async (ctx: RunContext, runId: string, anyone = false): Promise<void> => {
  const pending = unproved.get(ctx);
  if (!pending) {
    return;
  }

  const identified =
    anyone && pending.claim.kind === 'none'
      ? { agent: UNNAMED }
      : await identify(ctx.root, runPaths(ctx.root, runId), runId, pending.claim, ctx.now());
  pending.prove(identified.agent);
  unproved.delete(ctx);
  usageCaller(runPaths(ctx.root, runId).dir, identified.agent);
  if (identified.issued) {
    process.stderr.write(`${chalk.bold(issuedText(runId, identified.agent, identified.issued))}\n`);
  }
};

/**
 * Who opens a run: the lead — or a person at a terminal, for the lead they start — and never an agent of its team. The
 * lead's token is made with the run (`run open`), so no one after takes its name.
 */
export const opener = (ctx: RunContext): void => {
  const pending = unproved.get(ctx);
  if (!pending) {
    return;
  }

  const { claim } = pending;
  if (claim.kind === 'name' && claim.said !== LEAD) {
    throw new RunRefusal('lead-only', `${claim.said} opens no run: the lead does (or a person, at their terminal)`, {
      holder: LEAD
    });
  }

  pending.prove(LEAD);
  unproved.delete(ctx);
};

/** Who `ctx` was said to be, proved or not: what a refusal met before the proof is logged as. */
const saidBy = (ctx: RunContext): string => {
  const claim = unproved.get(ctx)?.claim;

  return claim === undefined ? ctx.agent : claim.kind === 'name' ? claim.said : UNNAMED;
};

/** The run a command is about: the token's, the one named, or the project's only active run. */
export const runOf = async (
  ctx: RunContext,
  options: RunCommandOptions,
  named?: string,
  /** A reading anyone may ask — a hook, a script: one who says nothing is `unnamed`, and no lead's step lets it in. */
  { anyone = false }: { anyone?: boolean } = {}
): Promise<string> => {
  const runId = await runNamed(ctx, options, named);
  await prove(ctx, runId, anyone);

  return runId;
};

const runNamed = async (ctx: RunContext, options: RunCommandOptions, named?: string): Promise<string> => {
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
/** The command as it was run, a token's secret kept out: what the run's activity says was asked. */
const commandLine = (): string =>
  ['plitzi', ...process.argv.slice(2)]
    .join(' ')
    .replace(/(--token[ =])\S+/g, '$1…')
    .replace(/\b([a-z0-9][a-z0-9_-]*\.[a-z0-9][a-z0-9_-]*)\.[0-9a-f]{48}\b/g, '$1.…')
    .replace(/\b([a-z0-9][a-z0-9_-]*\.@[a-z0-9][a-z0-9_-]*)\.[0-9a-f]{32}\b/g, '$1.…');

/**
 * What went wrong in a command, written into the run's activity: every refusal and every crash, with the command that
 * met it — the run's history is what its CLI is debugged from, and a refusal a loop of agents met twenty times, or a
 * crash after an approval, was nowhere in it. The run is the command's, or the token's, or the project's open one.
 */
const logFailure = async (ctx: RunContext | undefined, options: RunCommandOptions, entry: Record<string, unknown>) => {
  if (!ctx) {
    return;
  }

  const claim = unproved.get(ctx)?.claim;
  const fromToken =
    TOKEN.exec(ctx.token ?? '')?.[1] ?? (claim?.kind === 'agent' ? AGENT_TOKEN.exec(claim.token)?.[1] : undefined);
  const runId = options.run ?? fromToken ?? (await activeRuns(ctx.root).catch(() => [])).at(0);
  if (runId === undefined) {
    return;
  }

  await fs
    .appendFile(
      runPaths(ctx.root, runId).log,
      `${JSON.stringify({ at: ctx.now().toISOString(), by: saidBy(ctx), command: commandLine(), ...entry })}\n`
    )
    .catch(() => undefined);
};

export const act = async <T>(
  options: RunCommandOptions,
  work: (ctx: RunContext) => Promise<T>,
  text: (result: T) => string,
  exitCode: number | ((result: T) => number) = 0
): Promise<void> => {
  let context: RunContext | undefined;
  try {
    const ctx = await contextFor(options);
    context = ctx;
    await proveByToken(ctx);
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
      await logFailure(context, options, {
        action: 'crashed',
        error: caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught)
      });

      throw caught;
    }

    await logFailure(context, options, {
      action: 'refused',
      code: caught.code,
      message: caught.message.slice(0, 600)
    });

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
    const child = spawn(process.execPath, [process.argv[1], ...args], {
      cwd,
      env: { ...process.env, [USAGE_OFF]: '1' }
    });
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
