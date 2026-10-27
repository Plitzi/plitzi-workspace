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
import { contextNow, spentIn } from '../../runs/harness';
import { endsWith, HELD_WORD, heldBy } from '../../runs/held';
import { AGENT_TOKEN, identify, issuedText, UNNAMED } from '../../runs/identity';
import { LEAD } from '../../runs/messages';
import { COPY_TASK_FILE, copyOf, runPaths, scratchOf } from '../../runs/paths';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { activeRuns, loadRun } from '../../runs/run';
import { viewTask } from '../../runs/taskStore';
import { isQuality } from '../../runs/team';
import { ranCommand, USAGE_OFF, usageCaller } from '../../runs/usage';
import { CLI_VERSION } from '../../scaffold/project';
import { findProject } from '../existingProject';

import type { Held } from '../../runs/held';
import type { Claim } from '../../runs/identity';
import type { RunContext } from '../../runs/run';

/**
 * What every run and task command shares: who calls — the project it is run in, the copy and its task, the token —
 * which run, and `act`, which answers in text or JSON and turns a refusal into its exit code.
 */

export interface RunCommandOptions {
  json?: boolean;
  /** The caller's own token, as its first command on the run printed it; `PLITZI_TOKEN` otherwise. */
  token?: string;
  /** Who is calling, for the log: an agent's name. `PLITZI_AGENT` otherwise. */
  agent?: string;
  /** The run, when the token does not say it and the project has more than one. `PLITZI_RUN` otherwise. */
  run?: string;
  /** The level the agent was started at: handed tasks of it or below. `PLITZI_QUALITY` otherwise. */
  quality?: string;
}

/** A task's token says its run and its task: `<run>.<task>.<secret>` — kept in its copy, said to its holder. */
const TOKEN = /^([a-z0-9][a-z0-9_-]*)\.([a-z0-9][a-z0-9_-]*)\.([0-9a-f]{48})$/;

/**
 * The project the command works on: the one it is run in — and, run from inside a task's copy (which has a package.json
 * of its own), the project that copy belongs to.
 */
interface Where {
  /** The project the runs are of — the project itself, also when the command runs in a task's copy. */
  root: string;
  /** The shell's own folder. */
  here: string;
  /** Who the copy the command runs in is, as taking it wrote it there: none outside a copy. */
  copy?: { token: string; agent: string };
}

/** Who a task's copy is, as taking it wrote it: what a command run inside it needs no flag for. */
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
  const here = currentFolder();
  const project = await findProject(here);
  if (!project) {
    throw new RunRefusal('not-found', 'There is no package.json here or above: run this in the project');
  }

  const inCopy = copyOf(project.root);
  if (!inCopy) {
    return { root: scratchOf(project.root)?.root ?? project.root, here };
  }

  const copy = await copyTask(project.root);

  return { root: inCopy.root, here, ...(copy ? { copy } : {}) };
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

/** What a context's caller said of itself, until the run is known and it is proved (`runOf`). */
const unproved = new WeakMap<RunContext, { claim: Claim; prove: (agent: string) => void }>();

/** A flag or a variable said empty is none said: a `$(cat …)` that read nothing, a shell that cleared it. */
const saidValue = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

/** What the caller brought: its own token, a name, a terminal — or nothing, or a token that is no agent's. */
const claimOf = (said: { token?: string; name?: string; blank?: boolean }): Claim => {
  const { token, name, blank } = said;
  if (token !== undefined) {
    return AGENT_TOKEN.test(token)
      ? { kind: 'agent', token, ...(name === undefined ? {} : { said: name }) }
      : { kind: 'malformed', task: TOKEN.test(token) };
  }

  if (name !== undefined) {
    return { kind: 'name', said: name };
  }

  if (blank) {
    return { kind: 'none', empty: true };
  }

  return process.stdin.isTTY ? { kind: 'person' } : { kind: 'none' };
};

/**
 * Who runs a command, and on which task: an agent by its own token (`--token`, `PLITZI_TOKEN`) — inside a task's copy
 * too — and a person by their terminal; the copy says the task, to its holder alone. A name said alone is proved once
 * the run is known (`runOf`): its first time, it is made a token. Read before that, `agent` is a bug of the CLI's,
 * never a guess — a guess was the lead, then "agent".
 */
export const contextFor = async (options: RunCommandOptions): Promise<RunContext> => {
  const { root, here, copy } = await whereAmI();
  const token = saidValue(options.token) ?? saidValue(process.env.PLITZI_TOKEN);
  const name = saidValue(options.agent) ?? saidValue(process.env.PLITZI_AGENT);
  const quality = options.quality ?? process.env.PLITZI_QUALITY;
  if (quality !== undefined && quality !== '' && !isQuality(quality)) {
    throw new RunRefusal('invalid', `"${quality}" is no quality: light, standard or high (--quality, PLITZI_QUALITY)`);
  }

  // A `--token` said, and blank: told apart from none said, for what it means — a token file read from nowhere.
  const blank = token === undefined && options.token !== undefined;
  const claim = claimOf({
    ...(token === undefined ? {} : { token }),
    ...(name === undefined ? {} : { name }),
    ...(blank ? { blank } : {})
  });
  // The copy's task is its holder's: said to the token of the agent that took it, or to a person at its terminal —
  // the lead reviewing from inside a copy is the lead, holding no task.
  const ownName = claim.kind === 'agent' ? AGENT_TOKEN.exec(claim.token)?.[2] : undefined;
  const task = copy && (claim.kind === 'person' || ownName === copy.agent) ? copy.token : undefined;

  let agent: string | undefined;
  const ctx: RunContext = {
    root,
    cwd: here,
    now: () => new Date(),
    machine: os.hostname(),
    cli: CLI_VERSION,
    ...(task ? { token: task } : {}),
    get agent(): string {
      if (agent === undefined) {
        throw new Error('A run command read who calls before it was proved (runOf): a bug of the CLI');
      }

      return agent;
    },
    ...(isQuality(quality) ? { quality } : {}),
    person: askPerson,
    checks: projectChecks,
    context: () => contextNow(root, new Date()),
    spent: window => spentIn(root, window),
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

/** What is proved without the run named: an agent's token says its own run. */
const proveByToken = async (ctx: RunContext): Promise<void> => {
  const run = tokenRun(ctx);
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

/**
 * Who calls a command of the project's, not of one run's — the backlog: proved by the open run when there is one; with
 * none, a person at its terminal, else `unnamed` — never a name it says unproved, nor a crash (a run's lead,
 * closing an item once its run had finished).
 */
export const projectCaller = async (ctx: RunContext, options: RunCommandOptions): Promise<string> => {
  if (options.run !== undefined || tokenRun(ctx) !== undefined || (await activeRuns(ctx.root)).length > 0) {
    await runOf(ctx, options);

    return ctx.agent;
  }

  return unproved.get(ctx)?.claim.kind === 'person' ? 'person' : UNNAMED;
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

/** The run the caller's own token is of, before it is proved. */
const tokenRun = (ctx: RunContext): string | undefined => {
  const claim = unproved.get(ctx)?.claim;

  return claim?.kind === 'agent' ? AGENT_TOKEN.exec(claim.token)?.[1] : undefined;
};

const runNamed = async (ctx: RunContext, options: RunCommandOptions, named?: string): Promise<string> => {
  const fromToken = (ctx.token ? TOKEN.exec(ctx.token)?.[1] : undefined) ?? tokenRun(ctx);
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

/** The task a command is about: its copy's, which a named one must match. */
/** The task a token holds — none for an agent's own token (a reviewer's, one between tasks). */
export const tokenTask = (ctx: Pick<RunContext, 'token'>): string | undefined =>
  ctx.token ? TOKEN.exec(ctx.token)?.[2] : undefined;

export const taskOf = (ctx: Pick<RunContext, 'token'>, named?: string): string => {
  const fromToken = ctx.token ? TOKEN.exec(ctx.token)?.[2] : undefined;
  if (named && fromToken && named !== fromToken) {
    throw new RunRefusal('invalid', `This copy is task "${fromToken}"'s, not "${named}"'s`);
  }

  const task = named ?? fromToken;
  if (!task) {
    throw new RunRefusal('invalid', 'Name the task, or run this in its copy (cd <its work folder>)');
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

  const fromToken = TOKEN.exec(ctx.token ?? '')?.[1] ?? tokenRun(ctx);
  const runId = options.run ?? fromToken ?? (await activeRuns(ctx.root).catch(() => [])).at(0);
  if (runId === undefined) {
    return;
  }

  await fs
    .appendFile(
      runPaths(ctx.root, runId).log,
      `${JSON.stringify({ at: ctx.now().toISOString(), by: saidBy(ctx), command: commandLine(), ...ranCommand(), ...entry })}\n`
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

    // The task it was about, as data: what a task refused again and again is counted by — once read off its words.
    const task = typeof caught.detail.task === 'string' ? caught.detail.task : TOKEN.exec(context?.token ?? '')?.[2];
    await logFailure(context, options, {
      action: 'refused',
      code: caught.code,
      ...(task === undefined ? {} : { task }),
      message: caught.message.slice(0, 600),
      ...(caught.detail.messages && caught.detail.messages.length > 0 ? { handed: true } : {})
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

/**
 * This CLI as a child process, in `cwd`: what a lead's one command runs several of, each as it would by hand. With
 * `PLITZI_TIMING=1` each says how long it took, on stderr: where a slow command spends its time.
 */
export const runSelf = (cwd: string, args: string[]): Promise<{ code: number; output: string }> => {
  const started = Date.now();

  return new Promise<{ code: number; output: string }>(resolve => {
    const child = spawn(process.execPath, [process.argv[1], ...args], {
      cwd,
      env: { ...process.env, [USAGE_OFF]: '1' }
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('close', code => resolve({ code: code ?? 1, output }));
  }).then(done => {
    if (process.env.PLITZI_TIMING === '1') {
      process.stderr.write(chalk.dim(`· ${String(Date.now() - started)} ms: plitzi ${args.join(' ').slice(0, 120)}\n`));
    }

    return done;
  });
};

/** What `ctx.agent` has in hand across the run, of every kind (`held.ts`): nothing for the lead or an unnamed caller. */
export const heldNow = async (ctx: RunContext, runId: string): Promise<Held[]> => {
  if (ctx.agent === LEAD || ctx.agent === UNNAMED) {
    return [];
  }

  const loaded = await loadRun(ctx, runId);

  return heldBy(await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task))), ctx.agent);
};

/**
 * The one thing an agent holds when it names none: the task of the copy it runs in, else the one it has in hand — its
 * work, a review, a spike, alike. Nothing when it holds none, or several.
 */
export const inHand = async (ctx: RunContext, runId: string): Promise<Held | undefined> => {
  if (ctx.token !== undefined && TOKEN.exec(ctx.token)?.[2] !== undefined) {
    return { task: taskOf(ctx), kind: 'work', agent: ctx.agent };
  }

  const held = await heldNow(ctx, runId);
  const work = held.filter(each => each.kind === 'work');

  return work.length === 1 ? work[0] : held.length === 1 ? held[0] : undefined;
};

/** What an agent holds, said where a command needs a task at work: what it is, and what ends it. */
const heldText = (agent: string, held: readonly Held[]): string => {
  if (held.length === 0) {
    return `${agent} holds nothing at work: name the task, or run this in its copy (cd <its work folder>)`;
  }

  const [only] = held;

  return held.length === 1
    ? `${agent} holds ${only.task} as a ${HELD_WORD[only.kind]}, no task at work: it ends with ${endsWith(only)}; task context and task show read it, task progress notes where you are — the rest are a writer's`
    : `${agent} holds ${held.map(each => `${each.task} (${HELD_WORD[each.kind]})`).join(', ')}: name the task, or run this in its copy`;
};

/**
 * The task a holder's command is about: the token's or the one named — and, run outside the copy with the agent's own
 * token and no task named, the one task that agent holds at work (`task context` refused five times from the
 * project's folder, "Name the task", though the token said whose it was).
 */
const taskResolved = async (ctx: RunContext, runId: string, named?: string): Promise<string> => {
  try {
    return taskOf(ctx, named);
  } catch (error) {
    if (named !== undefined || ctx.agent === LEAD || ctx.agent === UNNAMED) {
      throw error;
    }

    const held = await heldNow(ctx, runId);
    const work = held.filter(each => each.kind === 'work');
    if (work.length === 1) {
      return work[0].task;
    }

    throw new RunRefusal('invalid', heldText(ctx.agent, work.length > 1 ? work : held));
  }
};

/**
 * The task an agent means when it names none: the one it has in hand, of any kind — a run's `task show` with no task was
 * refused twice, its agent holding one.
 */
export const ownTask = async (ctx: RunContext, runId: string): Promise<string> => {
  const held = await inHand(ctx, runId);

  return held?.task ?? taskResolved(ctx, runId);
};

/** The prelude every holder's command shares: the run and the task, from the token. */
export const holder = async (
  ctx: RunContext,
  options: RunCommandOptions
): Promise<{ runId: string; taskId: string }> => {
  const runId = await runOf(ctx, options);

  return { runId, taskId: await taskResolved(ctx, runId) };
};

/** For a task's holder or the lead: the token's task, else the one named. */
export const either = async (
  ctx: RunContext,
  options: RunCommandOptions,
  named?: string
): Promise<{ runId: string; taskId: string }> => {
  const runId = await runOf(ctx, options);

  // A reviewer reads the brief of what it reviews: a run's tester and designers were refused it four times, judging
  // without the plan's findings.
  return { runId, taskId: named === undefined ? await ownTask(ctx, runId) : await taskResolved(ctx, runId, named) };
};
