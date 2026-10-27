import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { auditRun } from './audit';
import { messagesOf } from './messages';
import { monitorRun } from './monitor';
import { readOwnership } from './ownership';
import { taskPaths } from './paths';
import { checkPlan } from './plan';
import { loadRun, openRun } from './run';
import { scopePlan, SCOPE_SPIKE } from './spike';
import { blockTask, completeResearch, nextTask, takeNext, taskContext, unblockTask } from './tasks';
import { viewRun } from './view';
import { flowStages } from '../commands/runs/monitorFlow';
import { researchSteps } from '../tests/research';
import { SCOUT, team, TESTERS } from '../tests/reviewerSteps';
import { benchPlan, makeBench, proven, teamFor } from '../tests/runProject';
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
const { found, approveFound } = researchSteps(() => bench);

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
describe('research: a card like any, finding out in the run', () => {
  it('opens a run on the ask as its scope, whose result is the tasks — each with what was found for it', async () => {
    await open(scopePlan('es-launch', ASK));
    expect(await statusOf(SCOPE_SPIKE)).toBe('ready');
    // The lead's from the open: at it on the board, never idle (the monitor said the lead was idle).
    expect((await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'lead')).toMatchObject({
      status: 'working',
      task: SCOPE_SPIKE
    });
    // A scout's to take: never a developer's.
    expect(await refusal(take('agent-1', SCOPE_SPIKE))).toMatchObject({
      message: expect.stringContaining('not a scout') as unknown
    });
    expect((await nextTask(bench.agent('agent-1'), 'es-launch')).task).toBeUndefined();

    // A stage refused leaves the card as it was: nothing said done that made nothing.
    const wrong = {
      ...scoped(),
      tasks: [{ ...scoped().tasks[0], spike: 'what', files: ['src/space/pages/home/index.ts'] }]
    };
    await refusal(
      completeResearch(lead(), 'es-launch', SCOPE_SPIKE, 'four pages', { tasks: await bench.writePlan(wrong) })
    );
    expect(await statusOf(SCOPE_SPIKE)).toBe('ready');

    expect(
      await completeResearch(lead(), 'es-launch', SCOPE_SPIKE, 'Four pages; the booking words differ', {
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

  // The scope's stage carried the run's own goal, and `run status` said it twice.
  // …and refused its stage for findings written as lists, one finding a line.
  it('keeps the goal once when the scope’s stage says it again, and takes findings written as a list', async () => {
    await open(scopePlan('es-launch', ASK));
    const stage = { ...scoped(), goal: ASK };
    // Written as a lead writes the file — a list where the type says words: what reading the file takes in.
    const listed = { ...stage.tasks[0], findings: ['The hero is 48px', '- The menu wraps at 390'] };
    await completeResearch(lead(), 'es-launch', SCOPE_SPIKE, 'Four pages', {
      tasks: await bench.writePlan({
        ...stage,
        tasks: [listed as unknown as RunPlan['tasks'][number], ...stage.tasks.slice(1)]
      })
    });

    const view = await viewRun(lead(), 'es-launch');
    expect(view.goal).toBe(ASK);
    const context = await taskContext(lead(), 'es-launch', stage.tasks[0].id);
    expect(context.state.findings?.map(each => each.text).join('\n')).toContain(
      '- The hero is 48px\n- The menu wraps at 390'
    );
  });

  // The scope's tasks named the VS sizes as the lead guessed them, and a stage stacked said no notice.
  it('says, as the scope stacks its tasks, the values none of their checks measures against the site', async () => {
    await open(scopePlan('es-launch', ASK, 'https://www.example.com'));
    const stage = scoped();
    stage.tasks[0].acceptance = ['The hero title is 48px'];

    const done = await completeResearch(lead(), 'es-launch', SCOPE_SPIKE, 'The hero is larger there', {
      tasks: await bench.writePlan(stage)
    });
    expect(done.notices?.join(' ')).toContain(`Task "${stage.tasks[0].id}" names values (48px)`);
  });

  // A run opened on its scope had no reference, and the amend that named it said nothing changed.
  it('takes the site the run copies at the open, and by an amend once open', async () => {
    await open(scopePlan('es-launch', ASK, 'https://www.example.com'));
    expect((await loadRun(lead(), 'es-launch')).plan.reference).toBe('https://www.example.com');
    const plan = { ...(await loadRun(lead(), 'es-launch')).plan, reference: 'https://www.example.org' };
    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(plan))).toMatchObject({
      reference: 'https://www.example.org'
    });
    expect((await loadRun(lead(), 'es-launch')).plan.reference).toBe('https://www.example.org');
  });

  // T-base's finding "write every stub" was wrong, and only a message and a run note could say so.
  it('amends what was found for a task: its brief says the new finding, its spikes’ kept, and it is told', async () => {
    const plan = { ...scoped(), runId: 'es-launch' };
    await open(plan);
    const { id } = plan.tasks[2];
    const amended = {
      ...plan,
      tasks: plan.tasks.map(task => (task.id === id ? { ...task, findings: 'Say "Reservar"' } : task))
    };
    expect((await amendRun(lead(), 'es-launch', await bench.writePlan(amended))).tasks).toEqual([
      { task: id, changed: ['findings'] }
    ]);
    const { state } = await taskContext(lead(), 'es-launch', id);
    expect(state.findings?.map(each => each.text)).toEqual(['Say "Reservar"']);
    const told = (await messagesOf(await loadRun(lead(), 'es-launch'))).find(each => each.to === id);
    expect(told?.text).toContain('What was found for it now says: Say "Reservar"');
  });

  it('ends research alone by its findings, what waits for it ready, reading them — and refuses an agent’s', async () => {
    await open(surveyed());
    expect(await statusOf('t-about')).toBe('pending');
    // Not the lead's, untaken: a scout's to take — one that holds nothing says nothing of it.
    expect(await refusal(completeResearch(bench.agent('agent-1'), 'es-launch', 's-survey', 'mine'))).toMatchObject({
      code: 'invalid'
    });

    expect(
      await completeResearch(lead(), 'es-launch', 's-survey', 'The original has a team grid; ours lacks it')
    ).toMatchObject({
      status: 'done',
      ready: ['t-about']
    });
    const about = await take('agent-2', 't-about');
    expect(
      (await taskContext(about.ctx, 'es-launch', 't-about')).related.find(each => each.task === 's-survey')?.findings
    ).toEqual([expect.objectContaining({ text: 'The original has a team grid; ours lacks it' })]);
    // Ended by what it found, not approved: no step the audit reads as missed (a run's s-scope).
    expect((await auditRun(await loadRun(lead(), 'es-launch'))).map(each => each.title).join(' ')).not.toContain(
      's-survey is done'
    );
  });

  it('blocks a task whose agent needs something found out on the lead, whose answer is its finding', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await blockTask(home.ctx, 'es-launch', 't-home', 'how the original greets a visitor', 'lead');
    expect(await statusOf('t-home')).toBe('blocked');
    // The block says what and how to answer it, and wakes the lead alone: no message beside it to answer.
    const blocked = (await viewRun(lead(), 'es-launch')).attention.find(item => item.task === 't-home');
    expect(blocked).toMatchObject({ kind: 'blocked', who: 'lead' });
    expect(blocked?.text).toContain('blocked: how the original greets a visitor');
    expect(blocked?.text).toContain('plitzi task unblock t-home --answer');
    expect((await messagesOf(await loadRun(lead(), 'es-launch'))).filter(message => message.from === 't-home')).toEqual(
      []
    );

    // A block answered by nothing is no answer; a work card is no research the lead says found.
    expect((await refusal(unblockTask(lead(), 'es-launch', 't-home'))).message).toContain('lift it with the answer');
    expect((await refusal(completeResearch(lead(), 'es-launch', 't-home', 'x'))).message).toContain(
      'is no research card'
    );

    expect(await unblockTask(lead(), 'es-launch', 't-home', '"¡Bienvenidos!", in the hero')).toMatchObject({
      status: 'in-progress'
    });
    expect((await taskContext(home.ctx, 'es-launch', 't-home')).state.findings).toEqual([
      expect.objectContaining({ by: 'lead', question: 'how the original greets a visitor' })
    ]);
  });

  it('hands each scout a research card as any card — once, the other scout not offered it — to the lead’s review', async () => {
    const plan = { ...surveyed() };
    plan.tasks.push({ ...plan.tasks[4], id: 's-words', spike: 'which words the original uses for a booking' });
    const file = await bench.writePlan(plan);
    const base = teamFor(plan, 2);
    await bench.writeTeam({
      ...base,
      agents: [...base.agents, { name: 'scout', roles: ['scout'], count: 2, session: 'keep' }]
    });
    await openRun(lead(), file);
    const offered = await takeNext(bench.agent('scout-1'), 'es-launch', 'scout');
    expect(offered.taken?.task.id).toBe('s-survey');
    expect((await takeNext(bench.agent('scout-2'), 'es-launch', 'scout')).taken?.task.id).toBe('s-words');
    // In the flow at work with its scout at it, as a task being written is.
    const work = flowStages((await viewRun(lead(), 'es-launch')).tasks).find(stage => stage.key === 'work');
    expect(work?.tasks.map(task => `${task.id} ${work.who(task)}`)).toContain('s-survey scout-1');
    expect((await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'scout-1')).toMatchObject({
      status: 'working',
      task: 's-survey'
    });
    // Findings alone, no tasks: in review with the lead too, who approves every research card.
    const scout = bench.agent('scout-1', { token: offered.taken?.token });
    expect(await completeResearch(scout, 'es-launch', 's-survey', 'A team grid')).toMatchObject({
      status: 'in-review',
      proposed: []
    });
    expect((await nextTask(lead(), 'es-launch', 'lead')).review).toMatchObject({
      task: { id: 's-survey' },
      found: { by: 'scout-1', text: 'A team grid', tasks: [] }
    });
  });

  // encore-12's scope proposed four tasks no command proved; the dry run said so, and the lead sent it back for them.
  it('refuses a proposal whose tasks no command proves, naming them', async () => {
    await bench.writeTeam(team(SCOUT, TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(surveyed()))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    const [first] = benchPlan().tasks;
    const stage = await bench.writePlan({
      ...benchPlan(),
      runId: 'survey',
      tasks: [
        {
          ...first,
          id: 't-grid',
          files: ['src/lib/grid.ts'],
          dependsOn: [],
          acceptance: ['The grid holds every member']
        }
      ]
    });

    expect((await refusal(found(runId, 's-survey', 'A team grid', { tasks: stage }))).message).toContain(
      't-grid has no acceptance line a command proves'
    );
    expect(await statusOf('s-survey')).toBe('in-progress');
  });

  // encore-11: the lead could keep a proposal whole or drop every task — and a -tests card it did not want stayed.
  it('stacks what the lead keeps of a proposal: a -tests card left is its card with no tests; what waits for one left, refused', async () => {
    const plan = { ...surveyed() };
    await bench.writeTeam(team(SCOUT, TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    const [first] = benchPlan().tasks;
    const stage = await bench.writePlan({
      ...benchPlan(),
      runId: 'survey',
      tasks: [
        proven({ ...first, id: 't-grid', title: 'The team grid', files: ['src/lib/grid.ts'], dependsOn: [] }),
        proven({ ...first, id: 't-bios', title: 'The bios', files: ['src/lib/bios.ts'], dependsOn: ['t-grid'] })
      ]
    });
    expect((await found(runId, 's-survey', 'A team grid, with bios', { tasks: stage })).proposed).toEqual([
      't-grid',
      't-bios',
      't-grid-tests',
      't-bios-tests'
    ]);

    expect((await refusal(approveFound(runId, 's-survey', ['t-grid']))).message).toContain('t-bios waits for t-grid');
    expect((await refusal(approveFound(runId, 's-survey', ['t-nope']))).message).toContain('proposes no t-nope');

    const approved = await approveFound(runId, 's-survey', ['t-grid-tests']);
    expect(approved.found).toMatchObject({
      added: ['t-grid', 't-bios', 't-bios-tests'],
      left: ['t-grid-tests']
    });

    // Kept in the run's inputs as stacked — what it left out, out — and its tasks amended from it: encore-12's lead
    // rebuilt the scope's stage from the tasks, and was refused.
    const kept = approved.found?.stage ?? '';
    expect(path.relative((await loadRun(lead(), runId)).paths.dir, kept)).toBe(
      path.join('inputs', 's-survey', 'stage.json')
    );
    const stacked = JSON.parse(await fs.readFile(kept, 'utf-8')) as RunPlan;
    expect(stacked.tasks.map(task => task.id)).not.toContain('t-grid-tests');
    stacked.tasks[0].acceptance = ['The grid holds every member'];
    await fs.writeFile(kept, JSON.stringify(stacked));
    expect((await amendRun(lead(), runId, kept)).tasks).toEqual([{ task: 't-grid', changed: ['acceptance'] }]);
    expect((await loadRun(lead(), runId)).tasks.find(task => task.id === 't-grid')?.tests).toBe(false);
    expect(await statusOf('s-survey')).toBe('done');
    expect(await statusOf('t-about')).toBe('ready');
  });

  // A run opened by the CLI before research was a card keeps working: its spike reads as a card ready, or in review.
  it('reads a research card an earlier CLI wrote in its own status as ready — or in review with what it found', async () => {
    await open(surveyed());
    const loaded = await loadRun(lead(), 'es-launch');
    const { state } = taskPaths(loaded.paths, 's-survey');
    const earlier = JSON.parse(await fs.readFile(state, 'utf-8')) as Record<string, unknown>;
    await fs.writeFile(
      state,
      JSON.stringify({ ...earlier, status: 'spike', spikedBy: { by: 'scout-1', at: earlier.updatedAt } })
    );
    expect(await statusOf('s-survey')).toBe('ready');

    const proposed = { by: 'scout-1', at: earlier.updatedAt, text: 'A team grid', tasks: [] };
    await fs.writeFile(state, JSON.stringify({ ...earlier, status: 'spike', proposed }));
    expect(await statusOf('s-survey')).toBe('in-review');
    expect((await nextTask(lead(), 'es-launch', 'lead')).review?.found).toMatchObject({
      by: 'scout-1',
      text: 'A team grid'
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
