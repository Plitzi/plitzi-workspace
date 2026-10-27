import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { holder } from './shell';
import { openRun } from '../../runs/run';
import { completeTask, takeNext, takeTask } from '../../runs/tasks';
import { setTeamAgent } from '../../runs/team';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

/** A run's design-2 ran `task progress` at a review and was told "holds no task at work: name it". */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, refusal } = runSteps(() => bench);

describe("a holder's command run by a reviewer", () => {
  it('says the review it holds speaks for itself, by its look and its verdict', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.map(task => (task.id === 't-home' ? { ...task, review: ['designer'] } : task));
    await openRun(lead(), await bench.writePlan(plan));
    const home = await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: `Hola` };\n');
    await completeTask(bench.agent('dev-1', { token: home.token }), 'es-launch', 't-home');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

    const refused = await refusal(holder(bench.agent('design-1'), {}));
    expect(refused.message).toContain('design-1 holds t-home as a review');
    expect(refused.message).toContain('its look (plitzi task look t-home) and its verdict');
  });
});
