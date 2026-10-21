import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { messagesOf } from './messages';
import { readOwnership } from './ownership';
import { checkPlan } from './plan';
import { loadRun } from './run';
import { answerSpike, completeTask, nextTask, startSpike, taskContext } from './tasks';
import { viewRun } from './view';
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
// uncounted, never shared out. A spike is that research in the run.
describe('a spike: finding out, in the run', () => {
  it('is taken while what it waits for is still being built — and its findings wait with it', async () => {
    await open(spikedPlan());
    expect(await statusOf('t-book')).toBe('spike');

    // Finding out waits for nothing: taken though t-home and t-menu are not done, none of its files held.
    const book = await take('agent-1', 't-book');
    expect(book.spike).toBe('which words the original uses for a booking');
    expect(await statusOf('t-book')).toBe('spike');
    expect(await refusal(completeTask(book.ctx, 'es-launch', 't-book'))).toMatchObject({
      message: expect.stringContaining('say what you found first') as unknown
    });

    // Found out, and not to be built yet: kept, its agent free.
    const found = await answerSpike(book.ctx, 'es-launch', 't-book', 'They say "Reservar mesa", never "Reserva"');
    expect(found).toMatchObject({ status: 'pending', released: { reason: 'it waits for t-home, t-menu' } });
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-book')?.agent).toBeUndefined();

    await doTask('agent-2', 't-home', 'src/space/pages/home/index.ts', 'export const home = { es: true };\n');
    await doTask('agent-3', 't-menu', 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');
    expect(await statusOf('t-book')).toBe('ready');

    // Whoever builds it reads what was found.
    const builder = await take('agent-4', 't-book');
    expect(builder.spike).toBeUndefined();
    expect((await taskContext(builder.ctx, 'es-launch', 't-book')).state.findings).toEqual([
      expect.objectContaining({
        by: 'agent-1',
        question: 'which words the original uses for a booking',
        text: 'They say "Reservar mesa", never "Reserva"'
      })
    ]);
  });

  it('ends research alone by its findings: the lead told, what waits for it ready, reading them', async () => {
    await open(spikedPlan());
    expect(await statusOf('t-about')).toBe('pending');

    const survey = await take('agent-1', 's-survey');
    expect(
      await answerSpike(survey.ctx, 'es-launch', 's-survey', 'The original has a team grid; ours lacks it')
    ).toMatchObject({ status: 'done', ready: ['t-about'] });

    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(message => message.about === 's-survey');
    expect(told).toMatchObject({ to: 'lead', fyi: true, text: expect.stringContaining('team grid') as unknown });
    const about = await take('agent-2', 't-about');
    expect(
      (await taskContext(about.ctx, 'es-launch', 't-about')).related.find(each => each.task === 's-survey')?.findings
    ).toEqual([expect.objectContaining({ text: 'The original has a team grid; ours lacks it' })]);
  });

  it('takes a task at work back to finding out, and on to building it, its files its own throughout', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await startSpike(home.ctx, 'es-launch', 't-home', 'how the original greets a visitor');
    expect(await statusOf('t-home')).toBe('spike');
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.spike).toBe(
      'how the original greets a visitor'
    );
    // Still its agent's: nobody else is offered it.
    expect((await nextTask(bench.agent('agent-2'), 'es-launch')).task?.id).not.toBe('t-home');

    expect(await answerSpike(home.ctx, 'es-launch', 't-home', '"¡Bienvenidos!", in the hero')).toMatchObject({
      status: 'in-progress'
    });
    expect((await taskContext(home.ctx, 'es-launch', 't-home')).state.findings).toHaveLength(1);
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
