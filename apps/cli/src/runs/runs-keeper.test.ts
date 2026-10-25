import { closeSync, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keepOnce, leadStartText, openKeeperLog } from './keeper';
import { abortRun } from './merge';
import { STARTING_MS } from './onDemand';
import { runPaths } from './paths';
import { RunRefusal } from './refusal';
import { openRun, stopRun } from './run';
import { completeTask, nextTask, takeTask } from './tasks';
import { setTeamAgent } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { StartAgent } from './keeper';
import type { Bench } from '../tests/runProject';

/**
 * Only the lead's `run watch --until lead` started agents, so while the lead reviewed or wrote a stage, ready
 * tasks waited with no developer running. The run's keeper starts them whatever the lead is doing.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

const launching = async () => {
  const teamFile = path.join(bench.root, '.plitzi', 'team.json');
  const team = JSON.parse(await fs.readFile(teamFile, 'utf-8')) as Record<string, unknown>;
  await fs.writeFile(teamFile, JSON.stringify({ ...team, options: { launch: 'claude' } }));
};

describe("the run's keeper", () => {
  it('starts a base agent whose session ended, while the run is open — and nothing once it stops or is gone', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], session: 'task' });
    await launching();
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);
    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', 'export const page = {};\n');
    await completeTask(bench.agent('dev-1', { token: taken.token }), 'es-launch', 't-home');
    expect(await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).toMatchObject({ finished: true });

    const started: string[] = [];
    const start: StartAgent = agent => {
      started.push(agent);

      return Promise.resolve('started');
    };
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ started: ['dev-1'], failed: [] });
    expect(started).toEqual(['dev-1']);

    await stopRun(lead(), 'es-launch', false, 'a pause');
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ started: [], failed: [] });

    await abortRun(bench.person(true), 'es-launch');
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ gone: true });
    // A whole flow of the run, step by step: seconds alone, past the default 5 s beside the suite under load.
  }, 30_000);

  // A run's keeper waited two minutes for its lead to start dev-1 and design-1 while `run open` said it starts them; the
  // lead's start was refused for a harness team.json named.
  it('starts the base the moment the run opens, when the team says how — nobody is left to start it by hand', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2, min: 1 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await launching();
    await openRun(lead(), await bench.writePlan(benchPlan()));

    const started: string[] = [];
    const start: StartAgent = agent => {
      started.push(agent);

      return Promise.resolve('started');
    };
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ started: ['dev-1', 'design-1'], failed: [] });
    expect((await viewRun(lead(), 'es-launch')).attention.map(item => item.text).join('\n')).not.toContain('--harness');
  });

  // A run's opener started its lead with `npx plitzi run agent lead --launch`, refused as nobody: the lead's own CLI
  // starts it, and `run open` says so.
  it('says who leads: the opener through the lead’s CLI, or an agent that CLI starts', () => {
    expect(leadStartText('/p/scratch/lead/plitzi', 'claude')).toBe(
      'You lead it through that CLI — or an agent does, started by it: /p/scratch/lead/plitzi run agent lead --launch (in claude, as the team says)'
    );
    expect(leadStartText('/p/scratch/lead/plitzi', undefined)).toMatch(/run agent lead --launch --harness <yours>$/);
  });

  it('starts nothing when the team names no harness to start it in', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], session: 'task' });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);

    expect(await keepOnce(lead(), 'es-launch', () => Promise.reject(new Error('never')))).toEqual({
      started: [],
      failed: []
    });
  });
});

// `run open` crashed opening cache/keeper.log, the run's cache not made yet — and no agent started.
describe("the keeper's log", () => {
  it('is opened in a run just opened, its cache folder made', async () => {
    await openRun(bench.agent('lead'), await bench.writePlan(benchPlan()));
    const { cache } = runPaths(bench.root, 'es-launch');
    await fs.rm(cache, { recursive: true, force: true });

    closeSync(openKeeperLog(cache));
    expect(existsSync(path.join(cache, 'keeper.log'))).toBe(true);
  });
});

// The keeper and the lead's watch started design-1 at once, and the watch told the lead it "could not be
// started" — it was running.
describe('an agent started meanwhile by another', () => {
  it('is no failure to start it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await launching();
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);

    const already: StartAgent = () => Promise.resolve('running');
    expect(await keepOnce(lead(), 'es-launch', already)).toEqual({ started: [], failed: [] });

    const broken: StartAgent = () => Promise.reject(new RunRefusal('invalid', 'claude did not start: no PATH'));
    expect(await keepOnce(lead(), 'es-launch', broken)).toEqual({
      started: [],
      failed: [{ agent: 'dev-1', message: 'claude did not start: no PATH' }]
    });
  });
});
