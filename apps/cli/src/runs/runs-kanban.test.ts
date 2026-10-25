import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addBacklogItem } from './backlog';
import { openRun } from './run';
import { completeTask, reviewTask, takeNext, takeTask } from './tasks';
import { setTeamAgent } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';

import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const lead = (): RunContext => bench.agent('lead');

/** A developer takes a task, writes it and completes it: in review, as its agent leaves it. */
const completed = async (name: string, taskId: string, file: string): Promise<void> => {
  const taken = await takeTask(bench.agent(name), 'es-launch', taskId);
  await writeInCopy(taken.work, file, `export const page = { title: '${taskId}' };\n`);
  await completeTask(bench.agent(name, { token: taken.token }), 'es-launch', taskId, {});
};

// Carlos: the flow is a kanban, and the lead keeps every agent busy — a run's agents waited their own verdicts with
// nothing to take, the designer beside two cards whose UI the lead had kept.
describe('an agent with nothing to take', () => {
  it('is said to the lead with the work it can stack for it — and, with none left, that it waits for its reviews', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    const idle = async () =>
      (await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'idle-team')?.text ?? '';

    expect(await idle()).toBe(
      'dev-1 has nothing to take — keep the board ahead of the team: nothing is left to give: the rest wait for their reviews — decide those first'
    );
    await addBacklogItem(lead(), { text: 'The footer wraps at 390', by: 'lead' });
    expect(await idle()).toContain("stack the backlog's b-1 as cards");
    await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);
    expect(await idle()).toBe('');
  });

  // The run's only UI reviewer was said idle — split a developer's card for it — eleven times, once each
  // time the cards the advice named changed.
  it('leaves out a designer while others’ work is under way, and says one idleness once whatever its words', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => ['t-menu', 't-about'].includes(task.id));
    await openRun(lead(), await bench.writePlan(plan));
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    // The designer is running, and asks for work while t-menu is under way: its UI review is coming.
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer', { timeoutMs: 30, everyMs: 10 });
    const idle = async () => (await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'idle-team');

    expect((await idle())?.text ?? '').not.toContain('design-1');

    await completed('dev-2', 't-about', 'src/space/pages/about.ts');
    const before = await idle();
    expect(before?.text).toContain('dev-2 has nothing to take');
    await addBacklogItem(lead(), { text: 'The footer wraps at 390', by: 'lead' });
    const after = await idle();
    expect(after?.text).not.toBe(before?.text);
    expect(after?.subject).toBe(before?.subject);
  });

  // Woken eight times at the end for developers with nothing of theirs left, told to split the tester's spec.
  it('is not said of an agent none of whose role’s cards is left, nor told to split another role’s card', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => ['t-menu', 't-about'].includes(task.id));
    const about = plan.tasks.find(task => task.id === 't-about');
    if (!about) {
      throw new Error('the bench plan has no t-about');
    }

    about.role = 'tester';
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);
    await takeTask(bench.agent('test-1'), 'es-launch', 't-about');

    const idle = (await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'idle-team');
    expect(idle?.text ?? '').not.toContain('dev-1');
  });
});
