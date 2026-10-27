import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openRun } from './run';
import { completeTask, nextTask, reviewTask, takeNext, takeTask } from './tasks';
import { setTeamAgent } from './team';
import { takeOnRead } from '../commands/runs/takeOnRead';
import { benchPlan, designed, makeBench, writeInCopy } from '../tests/runProject';
import { teamSteps } from '../tests/teamSteps';

import type { Bench } from '../tests/runProject';

/** A designer in a team's run: once it sent a task back, asked with no role, with a task only it takes, developing too. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, completed } = teamSteps(() => bench);

describe('a designer, once it sent a task back', () => {
  it('keeps a designer waiting for a task it sent back whose files are data, but whose changes reached a page', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    // Its own session kept: the wait is what is tested, not the fresh start after its review (tested on its own).
    await setTeamAgent(bench.root, 'design', { roles: ['designer'], session: 'keep' });
    const plan = benchPlan('data-run');
    plan.tasks = [{ ...plan.tasks[3], id: 't-data', files: ['src/data/menu.json'] }];
    await openRun(lead(), await bench.writePlan(designed(plan)));
    const taken = await takeTask(bench.agent('dev-1'), 'data-run', 't-data');
    await writeInCopy(taken.work, 'src/data/menu.json', '{ "items": [{ "id": "tea" }] }\n');
    // A page it reads changed too, taken by turns at complete: what a person sees changed.
    await writeInCopy(
      taken.work,
      'src/space/pages/about.ts',
      `export const about = { title: ${JSON.stringify('Tea')} };\n`
    );
    await completeTask(bench.agent('dev-1', { token: taken.token }), 'data-run', 't-data');
    await takeNext(bench.agent('design-1'), 'data-run', 'designer');
    await reviewTask(bench.agent('design-1'), 'data-run', 't-data', 'changes', [{ note: 'The tea has no price' }]);

    const after = await nextTask(bench.agent('design-1'), 'data-run', 'designer');
    expect(after.finished).toBeUndefined();
    expect(after.why).toContain('t-data');
  });
});

// Dev-1 and dev-2 asked `task next` with no role, were offered what a designer takes, and refused for it.
describe('an agent asking with no role', () => {
  it('asks as the roles the team started it with: a developer is offered no UI review', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    const next = await nextTask(bench.agent('dev-2'), 'es-launch');
    expect(next.review).toBeUndefined();
  });
});

// T-shell, the only designer's and critical, sat ready seven minutes — four developers at UI tasks kept a
// review always "coming", and design-1 waited for them until the lead messaged it.
describe('a designer with a task only a designer takes', () => {
  it('takes it though UI reviews are coming: nobody else would', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 1 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.map(task => (task.id === 't-about' ? { ...task, role: 'designer' } : task));
    await openRun(lead(), await bench.writePlan(designed(plan)));
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');

    const next = await nextTask(bench.agent('design-1'), 'es-launch', 'designer,developer');
    expect([next.task?.id, next.why]).toEqual(['t-about', undefined]);
  });
});

// A designer at a task of its own left every UI review to the lead: it waits for the reviews coming instead.
describe('a designer that develops too', () => {
  beforeEach(async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 1 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'] });
    await openRun(lead(), await bench.writePlan(designed(benchPlan())));
  });

  it('waits for the UI reviews coming rather than taking a task of its own, and takes one once none is', async () => {
    const menu = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    const waiting = await nextTask(bench.agent('design-1'), 'es-launch', 'designer,developer');
    expect([waiting.task?.id, waiting.why]).toEqual([
      undefined,
      expect.stringContaining('reviews are coming — t-menu (dev-1) at work') as unknown
    ]);

    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "t-menu" };\n');
    await completeTask(bench.agent('dev-1', { token: menu.token }), 'es-launch', 't-menu');
    expect((await nextTask(bench.agent('design-1'), 'es-launch', 'designer,developer')).review).toMatchObject({
      task: { id: 't-menu' },
      role: 'designer'
    });
  });
});

// A run's lead looked at a task's UI as its watch said to, while design-1 took the same review — and the lead's approval
// was refused for design-1's. The lead's word goes on any step, whoever reads it first.
describe('a designer’s step the lead decides', () => {
  it('is the lead’s word: approved whole, whatever step it was at', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(designed(plan)));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    // A look of the lead's takes no designer's step: it stays the designer's to be offered.
    await takeOnRead(lead(), 'es-launch', 't-menu');
    expect((await nextTask(bench.agent('design-1'), 'es-launch', 'designer')).review?.role).toBe('designer');
    await expect(reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).resolves.toMatchObject({
      merged: ['src/space/pages/menu.ts']
    });
  });
});
