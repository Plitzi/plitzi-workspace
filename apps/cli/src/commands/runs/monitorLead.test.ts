import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { waitForLead } from '../../runs/leadWatch';
import { monitorRun } from '../../runs/monitor';
import { runPaths } from '../../runs/paths';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open } = runSteps(() => bench);

const leadRow = async (runId: string) => (await monitorRun(lead(), runId)).agents.find(agent => agent.kind === 'lead');

// The lead works for the person too, away from the run for a while: its row said "idle" over a lead nobody could reach.
describe('the lead on the monitor', () => {
  it('watches the run while its watch waits, decides between, and is away past a while of neither', async () => {
    const runId = await open(benchPlan());
    expect(await leadRow(runId)).toMatchObject({ status: 'idle' });

    // Its watch marks it watching while it waits, and lets go as it ends.
    const watching = runPaths(bench.root, runId).leadWatching;
    await fs.writeFile(watching, JSON.stringify({ pid: process.pid, at: bench.now().toISOString() }));
    expect(await leadRow(runId)).toMatchObject({
      status: 'waiting',
      doing: expect.stringContaining('watches the run since') as unknown
    });
    await fs.rm(watching);
    await waitForLead(lead(), runId, { timeoutMs: 20, everyMs: 10, launch: false });
    await expect(fs.access(watching)).rejects.toThrow();

    bench.advance(3 * 60_000);
    expect(await leadRow(runId)).toMatchObject({
      status: 'away',
      doing: expect.stringContaining('away from the run since') as unknown
    });
    // A watch whose process is gone watches nothing.
    await fs.writeFile(watching, JSON.stringify({ pid: 999_999, at: bench.now().toISOString() }));
    expect(await leadRow(runId)).toMatchObject({ status: 'away' });
  });
});
