import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { leaveTask } from './leave';
import { benchPlan, makeBench } from '../../tests/runProject';
import { finishRun } from '../copies/merge';
import { viewTask } from '../core/taskStore';
import { loadRun, openRun } from '../run';
import { nextTask, takeTask } from '../tasks';

import type { Bench } from '../../tests/runProject';
import type { RunContext } from '../run';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

/** Who calls, by name. */
const as = (name: string): RunContext => bench.agent(name);

// A run's task found to be the platform's took a stop, an unblock, a reassign and `--leave-pending` to leave out, its
// agent working on in between: a lead could not take a task out of an open run.
describe('a task the lead leaves out', () => {
  it('cuts whoever holds it, leaves out what waits on it, and the finish writes the run without them', async () => {
    const plan = benchPlan();
    await bench.writeTeam({ version: 1, agents: [{ name: 'dev', roles: ['developer'], count: 2 }] });
    await openRun(as('lead'), await bench.writePlan(plan));
    await takeTask(as('dev-1'), plan.runId, 't-home');

    await expect(leaveTask(as('lead'), plan.runId, 't-home', ' ')).rejects.toMatchObject({ code: 'invalid' });
    const left = await leaveTask(as('lead'), plan.runId, 't-home', "the platform's, fixed in Plitzi");
    expect(left).toEqual({ left: ['t-home', 't-book'], cut: ['t-home'] });

    const loaded = await loadRun(as('lead'), plan.runId);
    const task = loaded.tasks.find(each => each.id === 't-home');
    if (!task) {
      throw new Error('t-home is the bench plan’s');
    }

    const home = await viewTask(loaded.paths, task);
    expect(home.state).toMatchObject({ status: 'left', left: { why: "the platform's, fixed in Plitzi", by: 'lead' } });
    expect(home.owner).toBeUndefined();
    // Its agent hears why, and no one is handed it again.
    const told = (await nextTask(as('dev-1'), plan.runId, 'developer')).messages;
    expect(told.map(message => message.text).join(' ')).toContain(
      "left out of the run: the platform's, fixed in Plitzi"
    );

    // What nobody decided still asks for --leave-pending; what the lead left out does not.
    const refused = await finishRun(bench.person(true), plan.runId, { apply: false, leavePending: false }).then(
      () => '',
      (error: unknown) => (error instanceof Error ? error.message : String(error))
    );
    expect(refused).toContain('Tasks are not done: t-menu (ready)');
    expect(refused).not.toContain('t-home');
  });
});
