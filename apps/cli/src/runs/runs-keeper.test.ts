import { closeSync, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keepOnce, openKeeperLog } from './keeper';
import { abortRun } from './merge';
import { STARTING_MS } from './onDemand';
import { runPaths } from './paths';
import { RunRefusal } from './refusal';
import { openRun, stopRun } from './run';
import { completeTask, nextTask, takeTask } from './tasks';
import { setTeamAgent } from './team';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { StartAgent } from './keeper';
import type { Bench } from '../tests/runProject';

/**
 * encore-2: only the lead's `run watch --until lead` started agents, so while the lead reviewed or wrote a stage, ready
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

      return Promise.resolve();
    };
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ started: ['dev-1'], failed: [] });
    expect(started).toEqual(['dev-1']);

    await stopRun(lead(), 'es-launch', false, 'a pause');
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ started: [], failed: [] });

    await abortRun(bench.person(true), 'es-launch');
    expect(await keepOnce(lead(), 'es-launch', start)).toEqual({ gone: true });
    // A whole flow of the run, step by step: seconds alone, past the default 5 s beside the suite under load.
  }, 30_000);

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

// encore-3: `run open` crashed opening cache/keeper.log, the run's cache not made yet — and no agent started.
describe("the keeper's log", () => {
  it('is opened in a run just opened, its cache folder made', async () => {
    await openRun(bench.agent('lead'), await bench.writePlan(benchPlan()));
    const { cache } = runPaths(bench.root, 'es-launch');
    await fs.rm(cache, { recursive: true, force: true });

    closeSync(openKeeperLog(cache));
    expect(existsSync(path.join(cache, 'keeper.log'))).toBe(true);
  });
});

// encore-3: the keeper and the lead's watch started design-1 at once, and the watch told the lead it "could not be
// started" — it was running.
describe('an agent started meanwhile by another', () => {
  it('is no failure to start it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await launching();
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);

    const already: StartAgent = agent =>
      Promise.reject(new RunRefusal('invalid', `${agent} is running (pid 1)`, { running: true }));
    expect(await keepOnce(lead(), 'es-launch', already)).toEqual({ started: [], failed: [] });

    const broken: StartAgent = () => Promise.reject(new RunRefusal('invalid', 'claude did not start: no PATH'));
    expect(await keepOnce(lead(), 'es-launch', broken)).toEqual({
      started: [],
      failed: [{ agent: 'dev-1', message: 'claude did not start: no PATH' }]
    });
  });
});
