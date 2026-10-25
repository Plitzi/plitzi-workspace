import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson, writeJson } from './files';
import { harnessOf, launchAgent } from './launchAgent';
import { runPaths } from './paths';
import { isRunRefusal } from './refusal';
import { loadRun } from './run';
import { runChanged } from './runChanged';
import { readTeam } from './team';
import { viewRun } from './view';

import type { RunContext } from './run';
import type { RunView } from './view';

/**
 * The run's own keeper of its agents: with the team's `options.launch`, the agents the run asks for — the base not
 * running, one on demand for work that waits, one a task was sent back to — are started as `run agent --launch` would,
 * whatever the lead is doing. Only the lead's `run watch` started them before, so while the lead reviewed
 * or wrote a stage, ready tasks waited with no developer running (Carlos saw four, and none at work).
 */

/** An agent the run asked for that could not be started, and why. */
export interface LaunchFailed {
  agent: string;
  message: string;
}

/**
 * What starts an agent, in `harness` — `launchAgent`, or a test's stand-in: `running` when it was started meanwhile by
 * another (the keeper, a lead's watch), what was asked being so.
 */
export type StartAgent = (agent: string, harness: string) => Promise<'started' | 'running'>;

const startWithLaunch =
  (ctx: RunContext, runId: string): StartAgent =>
  async (agent, harness) =>
    'running' in (await launchAgent(ctx, runId, agent, await harnessOf(harness))) ? 'running' : 'started';

/** Every `agents-needed` notice of the view, its agent started in the team's `options.launch` harness. */
export const launchAsked = async (
  ctx: RunContext,
  runId: string,
  view: RunView,
  start: StartAgent = startWithLaunch(ctx, runId)
): Promise<{ started: string[]; failed: LaunchFailed[] }> => {
  const harness = (await readTeam(ctx.root).catch(() => undefined))?.options?.launch;
  const asked = [
    ...new Set(view.attention.flatMap(item => (item.kind === 'agents-needed' && item.agent ? [item.agent] : [])))
  ];
  if (harness === undefined || asked.length === 0) {
    return { started: [], failed: [] };
  }

  const started: string[] = [];
  const failed: LaunchFailed[] = [];
  for (const agent of asked) {
    try {
      if ((await start(agent, harness)) === 'started') {
        started.push(agent);
      }
    } catch (error) {
      if (!isRunRefusal(error)) {
        throw error;
      }

      failed.push({ agent, message: error.message });
    }
  }

  return { started, failed };
};

/** How often the keeper looks, at most: a change in the run wakes it sooner. */
const KEEP_EVERY_MS = 15_000;

/** One pass of the keeper: the run's agents started as it asks, while it is open. `gone` once the run is. */
export const keepOnce = async (
  ctx: RunContext,
  runId: string,
  start?: StartAgent
): Promise<{ gone: true } | { started: string[]; failed: LaunchFailed[] }> => {
  try {
    const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
    if (loaded.record.status !== 'open') {
      return { started: [], failed: [] };
    }

    return await launchAsked(ctx, runId, await viewRun(ctx, runId), start);
  } catch (error) {
    if (isRunRefusal(error) && error.code === 'not-found') {
      return { gone: true };
    }

    throw error;
  }
};

/** `plitzi run keep`: the keeper, until the run is gone — what it could not start is said on its output. */
export const keepAgents = async (
  ctx: RunContext,
  runId: string,
  { everyMs = KEEP_EVERY_MS, say = (line: string) => console.log(line) } = {}
): Promise<void> => {
  const told = new Set<string>();
  for (;;) {
    const kept = await keepOnce(ctx, runId);
    if ('gone' in kept) {
      say(`${new Date().toISOString()} the run is gone: the keeper ends`);

      return;
    }

    for (const agent of kept.started) {
      say(`${new Date().toISOString()} started ${agent}`);
    }

    for (const each of kept.failed) {
      const line = `${each.agent}: ${each.message}`;
      if (!told.has(line)) {
        told.add(line);
        say(`${new Date().toISOString()} could not start ${line}`);
      }
    }

    await runChanged(runPaths(ctx.root, runId).dir, everyMs);
  }
};

/** Where the keeper of a run says it runs: its pid. */
const keeperFile = (ctx: RunContext, runId: string): string =>
  path.join(runPaths(ctx.root, runId).cache, 'keeper.json');

const isKeeper = (value: unknown): value is { pid: number } => isRecord(value) && typeof value.pid === 'number';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/**
 * The run's keeper started, when the team says how to launch its agents and none runs already: one keeper a run,
 * outliving the command that started it. Answers its pid, or why none was started.
 */
/**
 * The keeper's log — what it started and could not, read when an agent the run asked for never came — opened for it to
 * write in, its folder made: a run just opened has no `cache/` yet (a run's open crashed on it, the keeper unstarted).
 */
export const openKeeperLog = (cache: string): number => {
  mkdirSync(cache, { recursive: true });

  return openSync(path.join(cache, 'keeper.log'), 'a');
};

export const ensureKeeper = async (
  ctx: RunContext,
  runId: string,
  /** Whose the keeper's commands are — the lead's, at the open, before any of its commands exported its token. */
  token?: string
): Promise<{ pid: number; started: boolean } | { none: string }> => {
  const harness = (await readTeam(ctx.root).catch(() => undefined))?.options?.launch;
  if (harness === undefined) {
    return { none: "the team names no harness to start its agents in (team.json's options.launch)" };
  }

  const file = keeperFile(ctx, runId);
  const kept = await readJson(file, isKeeper, "the run's keeper").catch(() => undefined);
  if (kept && alive(kept.pid)) {
    return { pid: kept.pid, started: false };
  }

  const out = openKeeperLog(runPaths(ctx.root, runId).cache);
  const child = spawn(process.execPath, [process.argv[1], 'run', 'keep', runId], {
    cwd: ctx.root,
    detached: true,
    stdio: ['ignore', out, out],
    env: token === undefined ? process.env : { ...process.env, PLITZI_TOKEN: token }
  });
  closeSync(out);
  child.unref();
  if (child.pid === undefined) {
    return { none: 'its process did not start' };
  }

  await writeJson(file, { pid: child.pid, startedAt: ctx.now().toISOString() });

  return { pid: child.pid, started: true };
};

/** The keeper as the command that started it says it — never silent about agents it will or cannot start. */
export const keeperText = (kept: Awaited<ReturnType<typeof ensureKeeper>>, base: readonly string[] = []): string =>
  'none' in kept
    ? `No keeper: ${kept.none} — start the agents yourself (plitzi run agent <name> --launch --harness <yours>)`
    : kept.started
      ? `The run's keeper starts ${base.length > 0 ? `the team's base now — ${base.join(', ')} — and the rest` : 'its agents'} as the run asks (pid ${String(kept.pid)}, log in the run's cache/keeper.log): start none of them yourself`
      : `The run's keeper is at it (pid ${String(kept.pid)})`;
