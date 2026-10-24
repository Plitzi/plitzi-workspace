import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeSummary } from './report';
import { openRun } from './run';
import { benchPlan, makeBench } from '../tests/runProject';
import { LEAD_SAID, runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * encore-2's lead said the run was done with ten notices standing, and stacked a stage after. Every task done, the lead
 * closes what it was told first: its summary is refused while anything waits for it.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, doTask, refusal } = runSteps(() => bench);

describe("the lead's close", () => {
  it('is refused while something waits for the lead, every task done — and taken once it is settled', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = plan.tasks.filter(task => task.id === 't-home');
    await openRun(lead(), await bench.writePlan(plan));
    await doTask('agent-1', 't-home', 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await bench.write('summary.md', '# Done\n');
    // Something left in the project's tmp/ while the run is open: the lead's to settle.
    await bench.write('tmp/notes/draft.md', 'a note\n');

    const refused = await refusal(writeSummary(lead(), 'es-launch', 'summary.md', LEAD_SAID));
    expect(refused.code).toBe('invalid');
    expect(refused.message).toContain("not the lead's to close yet");
    expect(refused.message).toContain('tmp/notes');

    await fs.rm(path.join(bench.root, 'tmp/notes'), { recursive: true });
    await writeSummary(lead(), 'es-launch', 'summary.md', LEAD_SAID);
  });
});
