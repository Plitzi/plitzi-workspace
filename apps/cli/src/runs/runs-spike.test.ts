import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { messagesOf } from './messages';
import { monitorRun } from './monitor';
import { readOwnership } from './ownership';
import { checkPlan } from './plan';
import { loadRun, openRun } from './run';
import { answerSpike, nextTask, startSpike, takeNext, taskContext } from './tasks';
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

const { lead, open, take, doTask } = runSteps(() => bench);

const statusOf = async (taskId: string): Promise<string | undefined> =>
  (await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === taskId)?.status;

/** The bench's plan with a spike before t-book, and research alone — s-survey — that t-about waits for. */
const spikedPlan = (): RunPlan => {
  const plan = benchPlan();
  plan.tasks[2].spike = 'which words the original uses for a booking';
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

// The lead's research before a plan, and an agent's before it builds, were done outside the run: unseen by the monitor,
// uncounted, never shared out. A spike is that research in the run — a lead's, as an agent's model is not a lead's.
describe('a spike: finding out, in the run, a lead’s', () => {
  it('is no agent’s to take: a lead finds out, and the task is ready to be built — or waits, its findings with it', async () => {
    await open(spikedPlan());
    expect(await statusOf('t-book')).toBe('spike');
    expect(await refusal(take('agent-1', 't-book'))).toMatchObject({
      message: expect.stringContaining('is in spike: a lead finds out first') as unknown
    });
    expect((await nextTask(bench.agent('agent-1'), 'es-launch')).task?.id).not.toBe('t-book');

    // Found out while what it waits for is still being built: pending, its findings kept.
    const found = await answerSpike(lead(), 'es-launch', 't-book', 'They say "Reservar mesa", never "Reserva"');
    expect(found).toMatchObject({ status: 'pending' });

    await doTask('agent-2', 't-home', 'src/space/pages/home/index.ts', 'export const home = { es: true };\n');
    await doTask('agent-3', 't-menu', 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    expect(await statusOf('t-book')).toBe('ready');

    // Whoever builds it reads what was found.
    const builder = await take('agent-4', 't-book');
    expect((await taskContext(builder.ctx, 'es-launch', 't-book')).state.findings).toEqual([
      expect.objectContaining({
        by: 'lead',
        question: 'which words the original uses for a booking',
        text: 'They say "Reservar mesa", never "Reserva"'
      })
    ]);
  });

  it('ends research alone by its findings, what waits for it ready, reading them — and refuses an agent’s', async () => {
    await open(spikedPlan());
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

  it('takes a task at work back to a spike the lead answers — its agent and files its own throughout', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await startSpike(home.ctx, 'es-launch', 't-home', 'how the original greets a visitor');
    expect(await statusOf('t-home')).toBe('spike');
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'spikes',
        text: expect.stringContaining('t-home (how the original greets a visitor, agent-1 waits)') as unknown
      })
    );
    const asked = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(message => message.from === 't-home');
    expect(asked?.text).toContain('needs a spike');

    expect(await answerSpike(lead(), 'es-launch', 't-home', '"¡Bienvenidos!", in the hero')).toMatchObject({
      status: 'in-progress',
      told: 'agent-1'
    });
    expect((await taskContext(home.ctx, 'es-launch', 't-home')).state.findings).toHaveLength(1);
  });

  it('hands a lead that reviews a spike when no review waits — once, the other lead not offered it', async () => {
    const plan = { ...spikedPlan(), designReview: false };
    const file = await bench.writePlan(plan);
    await bench.writeTeam({ ...teamFor(plan, 4), lead: { count: 3 } });
    await openRun(lead(), file);
    const offered = await takeNext(bench.agent('lead-2'), 'es-launch', 'lead');
    expect(offered.next.spike).toMatchObject({
      task: { id: 's-survey' },
      question: 'what the original about page has that ours lacks'
    });
    expect((await takeNext(bench.agent('lead-3'), 'es-launch', 'lead')).next.spike?.task.id).toBe('t-book');
    // In the flow, with the lead at it — never "free": no agent takes a spike.
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

  it('refuses a research with a command on its acceptance, and a task that writes nothing and finds out nothing', async () => {
    const plan = spikedPlan();
    const survey = plan.tasks.find(task => task.id === 's-survey');
    if (!survey) {
      throw new Error('the plan has no s-survey');
    }

    survey.acceptance = [{ said: 'Lists the gaps', check: 'true' }];
    plan.tasks[0] = { ...plan.tasks[0], files: [] };
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 2)).catch(
      (error: unknown) => error
    );

    const said = checked instanceof Error ? checked.message : JSON.stringify(checked);
    expect(said).toContain('Task "s-survey" is research alone');
    expect(said).toContain('Task "t-home" writes no file');
  });
});
