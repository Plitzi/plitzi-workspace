import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { taskContext } from '../tasks';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

// A run's amendment of two tasks' acceptance and findings was refused whole for one dependsOn of a task in hand.
describe('an amendment that asks of a taken task what changes only before it is taken', () => {
  it('leaves that out, said, and amends the rest', async () => {
    await open();
    await take('agent-1', 't-home');
    const plan = benchPlan();
    plan.tasks[0].role = 'designer';
    plan.tasks[0].acceptance = [{ said: 'The hero says Hola', check: 'grep -q Hola src/space/pages/home/hero.ts' }];
    plan.tasks[1].quality = 'high';

    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(plan))).toMatchObject({
      tasks: [
        { task: 't-home', changed: ['acceptance'] },
        { task: 't-menu', changed: ['quality'] }
      ],
      leftOut: [
        expect.stringContaining('"t-home" is in-progress: its role — what an agent took it as — left as it was')
      ]
    });
    const home = (await taskContext(lead(), 'es-launch', 't-home')).task;
    expect(home.role).toBeUndefined();
    expect(home.acceptance).toEqual(plan.tasks[0].acceptance);
  });
});
