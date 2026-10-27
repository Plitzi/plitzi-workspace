import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addBacklogItem } from './backlog';
import { leadItems, wakesLead } from './leadWatch';
import { openRun } from './run';
import { settleFinding } from './settle';
import { scopePlan, SCOPE_SPIKE } from './spike';
import { completeTask, reviewTask, takeNext, takeTask } from './tasks';
import { setTeamAgent } from './team';
import { viewRun } from './view';
import { researchSteps } from '../tests/research';
import { benchPlan, makeBench, provenPlan, writeInCopy } from '../tests/runProject';

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
const { found, progress, sendBack } = researchSteps(() => bench);

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

  // A run's lead was woken at each approval for one idle developer, every card left in review: nothing to do but wait.
  it('wakes the lead for nothing: said with what wakes it, or as its watch ends', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');

    const items = leadItems(await viewRun(lead(), 'es-launch'));
    const idle = items.find(item => item.key.startsWith('idle-team:'));
    const review = items.find(item => item.key.startsWith('review:t-menu'));
    expect(idle && wakesLead(idle)).toBe(false);
    expect(review && wakesLead(review)).toBe(true);
    // The same idle agent is the same advice, whatever card is done since.
    expect(idle?.key).toBe('idle-team::dev-1');
  });

  // A run's lead kept a run small on purpose, and was woken twice to stack the backlog with no way to say no.
  it('is said no more once the lead settles it, whatever changes on the board', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await addBacklogItem(lead(), { text: 'The footer wraps at 390', by: 'lead' });
    const idle = async () => (await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'idle-team');
    expect(await idle()).toBe(true);

    await settleFinding(lead(), 'es-launch', 'idle-team', 'A quick run: the person asked for these cards alone');
    expect(await idle()).toBe(false);
    await addBacklogItem(lead(), { text: 'The header wraps at 390', by: 'lead' });
    expect(await idle()).toBe(false);
    await expect(settleFinding(lead(), 'es-launch', 'idle-team', 'again')).rejects.toThrow('settled already');
  });

  // A run's lead settled idle-team the moment its developer was started again between two cards — refused, "no
  // advice of that kind is given now" — and was woken for it again at once.
  it('is settled by its kind though not given this moment', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    const plan = benchPlan();
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await openRun(lead(), await bench.writePlan(plan));
    const idle = async () => (await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'idle-team');
    expect(await idle()).toBe(false);

    expect((await settleFinding(lead(), 'es-launch', 'idle-team', 'The backlog left is past this run')).text).toContain(
      'said no more in this run'
    );
    await completed('dev-1', 't-menu', 'src/space/pages/menu.ts');
    await addBacklogItem(lead(), { text: 'The footer wraps at 390', by: 'lead' });
    expect(await idle()).toBe(false);
    await expect(settleFinding(lead(), 'es-launch', 'nope', 'x')).rejects.toThrow(/Nothing waits|Nothing to settle/);
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

  // A run's watch said scout-1, its scope in the lead's review, had nothing to take — stack the backlog for it.
  it('is not said of a scout whose research waits for the lead: the lead decides it, and no backlog feeds a scout', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'scout', { roles: ['scout'] });
    await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site into Spanish')));
    await takeNext(bench.agent('scout-1'), 'es-launch', 'scout', { timeoutMs: 30, everyMs: 10 });
    await addBacklogItem(lead(), { text: 'The footer wraps at 390', by: 'lead' });
    await found('es-launch', SCOPE_SPIKE, 'Four pages', { tasks: await bench.writePlan(provenPlan(benchPlan())) });

    const idle = (await viewRun(lead(), 'es-launch')).attention.find(item => item.kind === 'idle-team');
    expect(idle?.text ?? '').not.toContain('scout-1');
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

// A run's scope, sent back, read "measuring the show schedule's time zone; then writing the stage · 75 %" on the
// board — its last round's progress.
describe('a card sent back', () => {
  it('starts its round with no progress of the last one', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'scout', { roles: ['scout'] });
    await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site into Spanish')));
    await takeNext(bench.agent('scout-1'), 'es-launch', 'scout', { timeoutMs: 30, everyMs: 10 });
    await progress('es-launch', SCOPE_SPIKE, { fraction: 0.75, step: 'writing the stage' });
    await found('es-launch', SCOPE_SPIKE, 'Four pages', { tasks: await bench.writePlan(provenPlan(benchPlan())) });
    await sendBack('es-launch', SCOPE_SPIKE, 'Give each task a checked line');

    const card = (await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === SCOPE_SPIKE);
    expect(card?.status).toBe('changes-requested');
    expect(card?.fraction).toBeUndefined();
    expect(card?.step).not.toBe('writing the stage');
  });
});
