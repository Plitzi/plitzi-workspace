import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addBacklogItem } from './backlog';
import { openRun } from './run';
import { completeTask, reviewTask, takeTask } from './tasks';
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

// Carlos: the flow is a kanban, and the lead keeps every agent busy — lx-controls' agents waited their own verdicts with
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
});
