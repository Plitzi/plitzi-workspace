import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { messagesOf } from './messages';
import { monitorRun } from './monitor';
import { readOwnership } from './ownership';
import { checkPlan } from './plan';
import { loadRun, openRun } from './run';
import { scopePlan, SCOPE_SPIKE } from './spike';
import { answerSpike, nextTask, startSpike, takeNext, taskContext, unblockTask } from './tasks';
import { viewRun } from './view';
import { flowLines } from '../commands/runs/monitorFlow';
import { benchPlan, makeBench, teamFor } from '../tests/runProject';
import { refusal, runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

const statusOf = async (taskId: string): Promise<string | undefined> =>
  (await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === taskId)?.status;

const ASK = 'Translate the site into Spanish';

/** What the scope found, as its result: the bench's tasks, one with what was found for it. */
const scoped = (): RunPlan => {
  const plan = { ...benchPlan(), runId: 'es-scope', goal: 'The scope’s tasks' };
  plan.tasks[2] = { ...plan.tasks[2], findings: 'The original says "Reservar mesa", never "Reserva"' };

  return plan;
};

/** The bench's plan with research alone — s-survey — that t-about waits for. */
const surveyed = (): RunPlan => {
  const plan = benchPlan();
  plan.tasks[3].dependsOn = ['s-survey'];
  plan.tasks.push({
    id: 's-survey',
    title: 'Survey the about page against the original',
    files: [],
    dependsOn: [],
    priority: 'high',
    estimateMinutes: 10,
    acceptance: ['Says each section the original has and ours lacks'],
    spike: 'what the original about page has that ours lacks'
  });

  return plan;
};

// The lead's research before a plan was done outside the run, and a spike a task — hundreds of them, each found out by
// one and built by another. A run opens on the ask as one spike, its scope, and its result is the tasks: as a project
// starts — the lead scopes it, and the work flows from there.
describe('a spike: finding out, in the run, a lead’s', () => {
  it('opens a run on the ask as its scope, whose result is the tasks — each with what was found for it', async () => {
    await open(scopePlan('es-launch', ASK));
    expect(await statusOf(SCOPE_SPIKE)).toBe('spike');
    // The lead's from the open: at it on the board, never idle (velada-polish: the monitor said the lead was idle).
    expect((await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'lead')).toMatchObject({
      status: 'working',
      task: SCOPE_SPIKE
    });
    expect(await refusal(take('agent-1', SCOPE_SPIKE))).toMatchObject({
      message: expect.stringContaining('is in spike: a lead finds out first') as unknown
    });
    expect((await nextTask(bench.agent('agent-1'), 'es-launch')).task).toBeUndefined();

    // A stage refused leaves the spike open: nothing said done that made nothing.
    const wrong = {
      ...scoped(),
      tasks: [{ ...scoped().tasks[0], spike: 'what', files: ['src/space/pages/home/index.ts'] }]
    };
    await refusal(answerSpike(lead(), 'es-launch', SCOPE_SPIKE, 'four pages', { tasks: await bench.writePlan(wrong) }));
    expect(await statusOf(SCOPE_SPIKE)).toBe('spike');

    expect(
      await answerSpike(lead(), 'es-launch', SCOPE_SPIKE, 'Four pages; the booking words differ', {
        tasks: await bench.writePlan(scoped())
      })
    ).toMatchObject({
      status: 'done',
      added: ['t-home', 't-menu', 't-book', 't-about'],
      ready: ['t-home', 't-menu', 't-about']
    });
    expect(await statusOf('t-book')).toBe('pending');

    // Whoever builds it reads what the scope found for it.
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-book')?.found).toBe(1);
  });

  // velada-polish: a run opened on its scope had no reference, and the amend that named it said nothing changed.
  it('takes the site the run copies at the open, and by an amend once open', async () => {
    await open(scopePlan('es-launch', ASK, 'https://www.example.com'));
    expect((await loadRun(lead(), 'es-launch')).plan.reference).toBe('https://www.example.com');
    const plan = { ...(await loadRun(lead(), 'es-launch')).plan, reference: 'https://www.example.org' };
    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(plan))).toMatchObject({
      reference: 'https://www.example.org'
    });
    expect((await loadRun(lead(), 'es-launch')).plan.reference).toBe('https://www.example.org');
  });

  it('ends research alone by its findings, what waits for it ready, reading them — and refuses an agent’s', async () => {
    await open(surveyed());
    expect(await statusOf('t-about')).toBe('pending');
    expect(await refusal(answerSpike(bench.agent('agent-1'), 'es-launch', 's-survey', 'mine'))).toMatchObject({
      code: 'lead-only'
    });

    expect(
      await answerSpike(lead(), 'es-launch', 's-survey', 'The original has a team grid; ours lacks it')
    ).toMatchObject({
      status: 'done',
      ready: ['t-about']
    });
    const about = await take('agent-2', 't-about');
    expect(
      (await taskContext(about.ctx, 'es-launch', 't-about')).related.find(each => each.task === 's-survey')?.findings
    ).toEqual([expect.objectContaining({ text: 'The original has a team grid; ours lacks it' })]);
  });

  it('blocks a task whose agent needs something found out on the lead, whose answer is its finding', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    expect(await startSpike(home.ctx, 'es-launch', 't-home', 'how the original greets a visitor')).toMatchObject({
      status: 'blocked'
    });
    expect(await statusOf('t-home')).toBe('blocked');
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'blocked',
        text: 't-home blocked: needs a spike: how the original greets a visitor'
      })
    );
    const asked = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(message => message.from === 't-home');
    expect(asked?.text).toContain('plitzi task unblock t-home --answer');

    // A spike answered by nothing is no answer; a task's is not a spike the lead says done.
    expect((await refusal(unblockTask(lead(), 'es-launch', 't-home'))).message).toContain(
      'lift it with what you found'
    );
    expect((await refusal(answerSpike(lead(), 'es-launch', 't-home', 'x'))).message).toContain('not a spike');

    expect(await unblockTask(lead(), 'es-launch', 't-home', '"¡Bienvenidos!", in the hero')).toMatchObject({
      status: 'in-progress'
    });
    expect((await taskContext(home.ctx, 'es-launch', 't-home')).state.findings).toEqual([
      expect.objectContaining({ by: 'lead', question: 'how the original greets a visitor' })
    ]);
  });

  it('hands a lead that reviews a spike when no review waits — once, the other lead not offered it', async () => {
    const plan = { ...surveyed(), designReview: false };
    plan.tasks.push({ ...plan.tasks[4], id: 's-words', spike: 'which words the original uses for a booking' });
    const file = await bench.writePlan(plan);
    await bench.writeTeam({ ...teamFor(plan, 4), lead: { count: 3 } });
    await openRun(lead(), file);
    const offered = await takeNext(bench.agent('lead-2'), 'es-launch', 'lead');
    expect(offered.next.spike).toMatchObject({
      task: { id: 's-survey' },
      question: 'what the original about page has that ours lacks'
    });
    expect((await takeNext(bench.agent('lead-3'), 'es-launch', 'lead')).next.spike?.task.id).toBe('s-words');
    // In the flow and the board's task row, with the lead at it — never "free": no agent takes a spike.
    const flow = flowLines((await viewRun(lead(), 'es-launch')).tasks, 200).map(line => stripVTControlCharacters(line));
    expect(flow.some(line => line.includes('s-survey lead-2'))).toBe(true);
    // On the board at its spike, never idle.
    expect((await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'lead-2')).toMatchObject({
      status: 'working',
      doing: 'finds out for s-survey: what the original about page has that ours lacks',
      task: 's-survey'
    });
    expect(await answerSpike(bench.agent('lead-2'), 'es-launch', 's-survey', 'A team grid')).toMatchObject({
      status: 'done'
    });
  });

  it('refuses a spike that writes files, research with a command, and a task that writes nothing and finds out nothing', async () => {
    const plan = surveyed();
    const survey = plan.tasks.find(task => task.id === 's-survey');
    if (!survey) {
      throw new Error('the plan has no s-survey');
    }

    survey.acceptance = [{ said: 'Lists the gaps', check: 'true' }];
    plan.tasks[0] = { ...plan.tasks[0], files: [] };
    plan.tasks[1] = { ...plan.tasks[1], spike: 'which prices' };
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 2)).catch(
      (error: unknown) => error
    );

    const said = checked instanceof Error ? checked.message : JSON.stringify(checked);
    expect(said).toContain('Task "s-survey" is research alone');
    expect(said).toContain('Task "t-home" writes no file');
    expect(said).toContain('a spike is research alone (no files)');
  });
});
