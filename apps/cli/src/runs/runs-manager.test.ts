import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { leadItems } from './leadWatch';
import { messagesOf } from './messages';
import { agentsNeeded } from './onDemand';
import { loadRun, logRun, openRun, readRunLog } from './run';
import { askLead, tellLeadAbout } from './talk';
import {
  answerSpike,
  approveSpike,
  completeTask,
  escalateReview,
  nextTask,
  reassignTask,
  reviewTask,
  startSpike,
  takeNext,
  unblockTask
} from './tasks';
import { viewTask } from './taskStore';
import { readTeam, startedAgents } from './team';
import { viewRun } from './view';
import { reviewerSteps, SCOUT, team, TESTERS } from '../tests/reviewerSteps';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Bench } from '../tests/runProject';

/**
 * The lead as manager, where the team's roles meet: a review no tester may take, a question open at a review, an
 * escalation answered, what the team told the lead of a task, and the lead's close.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, take } = runSteps(() => bench);
const { twoInReview } = reviewerSteps(() => bench);

describe('a review no tester may take', () => {
  // The one tester writes every `-tests` card: its own were offered to nobody, and nothing said so.
  it('is a developer’s that did not work it — never the lead’s while one may', async () => {
    const members = {
      version: 1 as const,
      agents: [
        { name: 'dev', roles: ['developer'], count: 2, min: 1 },
        { ...TESTERS, count: 1 }
      ]
    };
    await bench.writeTeam(members);
    const plan: RunPlan = { ...benchPlan(), designReview: false };
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, role: 'tester' } : task));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const taken = await take('test-1', 't-menu');
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(taken.ctx, runId, 't-menu');

    expect((await nextTask(bench.agent('test-1'), runId, 'tester')).leadReview).toBeUndefined();
    expect((await nextTask(lead(), runId, 'lead')).leadReview).toBeUndefined();
    expect(leadItems(await viewRun(lead(), runId)).filter(item => item.key.startsWith('review:t-menu:'))).toEqual([]);
    expect((await viewRun(lead(), runId)).tasks.find(task => task.id === 't-menu')?.spareReviewers).toEqual([
      'dev-1',
      'dev-2'
    ]);
    // Neither running: one is started for it.
    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const asked = agentsNeeded(views, startedAgents(members), new Set(['test-1']), run);
    expect(asked.find(each => each.agent === 'dev-1')?.text).toContain('the review of t-menu (each tester worked it)');

    expect((await takeNext(bench.agent('dev-1'), runId, 'developer')).next.leadReview?.task.id).toBe('t-menu');
    expect(await reviewTask(bench.agent('dev-1'), runId, 't-menu', 'approve', [])).toMatchObject({
      verdict: 'approve'
    });
  });

  // Carlos: the lead reviews nothing by default — only what would hold the run, nobody else able to.
  it('is the lead’s when nobody else may: every developer worked what its tests test', async () => {
    const members = {
      version: 1 as const,
      agents: [
        { name: 'dev', roles: ['developer'] },
        { ...TESTERS, count: 1 }
      ]
    };
    await bench.writeTeam(members);
    const plan: RunPlan = { ...benchPlan(), designReview: false };
    const home = plan.tasks.find(task => task.id === 't-home') ?? plan.tasks[0];
    plan.tasks = [
      { ...home, tests: false },
      {
        ...home,
        id: 't-home-tests',
        title: 'Tests of the home',
        role: 'tester',
        files: ['src/lib/homeChecks.ts'],
        dependsOn: ['t-home']
      }
    ];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const work = await take('dev-1', 't-home');
    await writeInCopy(work.work, 'src/space/pages/home/index.ts', 'export const page = { title: "Inicio" };\n');
    await completeTask(work.ctx, runId, 't-home');
    await reviewTask(bench.agent('test-1'), runId, 't-home', 'approve', []);
    const tests = await take('test-1', 't-home-tests');
    await writeInCopy(tests.work, 'src/lib/homeChecks.ts', 'export const checked = true;\n');
    await completeTask(tests.ctx, runId, 't-home-tests');

    expect((await nextTask(bench.agent('dev-1'), runId, 'developer')).leadReview).toBeUndefined();
    const woken = leadItems(await viewRun(lead(), runId)).filter(item => item.key.startsWith('review:t-home-tests:'));
    expect(woken.map(item => item.text)).toEqual([expect.stringContaining('nobody else may')]);
    expect((await nextTask(lead(), runId, 'lead')).leadReview?.task.id).toBe('t-home-tests');

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const asked = agentsNeeded(views, startedAgents(members), new Set(['test-1']), run);
    expect(asked.map(each => each.text).join(' ')).not.toContain('the review of t-home-tests');
  });
});

describe('a question the task asked, open at its review', () => {
  it('has a tester hand the review to the lead, whose answer it is', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan({ ...benchPlan(), designReview: false }))).checked;
    const menu = await take('agent-1', 't-menu');
    await askLead(menu.ctx, runId, 't-menu', 'Prices with the euro sign?');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const refused = await refusal(reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []));
    expect(refused.message).toContain('plitzi task review t-menu --escalate');
    expect(refused.message).not.toContain('task message');
  });
});

describe('the lead, every task approved', () => {
  it('is told to look, report and finish — and never stops', async () => {
    const plan: RunPlan = { ...benchPlan(), designReview: false };
    plan.tasks = plan.tasks.filter(task => task.id === 't-menu');
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []);

    const next = await nextTask(lead(), runId, 'lead');
    expect(next.why).toContain('look at the result whole — plitzi run look — then the report');
    const log = await readRunLog((await loadRun(lead(), runId)).paths);
    expect(log.filter(entry => entry.action === 'stops' && entry.by === 'lead')).toEqual([]);
  });
});

describe('an escalated review the lead answers', () => {
  // Escalated at its first round, answered: back in progress, its agent stopped at its complete — and nobody started it.
  it('asks for its agent again, stopped since its complete', async () => {
    const { runId } = await twoInReview();
    const offered = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.leadReview?.task.id ?? '';
    await escalateReview(bench.agent('test-1'), runId, offered, 'Prices with the euro sign, or without?');
    const owner = offered === 't-menu' ? 'agent-1' : 'agent-2';
    const loaded = await loadRun(lead(), runId);
    await logRun(bench.agent(owner), loaded.paths, { action: 'stops', why: 'a fresh context' });
    await unblockTask(lead(), runId, offered, 'With the euro sign');

    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const started = startedAgents((await readTeam(bench.root)) ?? team(TESTERS));
    const asked = agentsNeeded(views, started, new Set(['test-1', 'test-2']), run);
    expect(asked.find(each => each.agent === owner)?.text).toContain(`${offered} was handed back`);
  });
});

describe('what the team told the lead of a task', () => {
  it('comes to whoever reviews it', async () => {
    const { runId } = await twoInReview();
    await tellLeadAbout(bench.agent('agent-2'), runId, 't-menu', 'Its prices are read once, at authoring');
    const offers = [
      (await takeNext(bench.agent('test-1'), runId, 'tester')).next.leadReview,
      (await takeNext(bench.agent('test-2'), runId, 'tester')).next.leadReview
    ];
    expect(offers.find(offer => offer?.task.id === 't-menu')?.told).toEqual([
      'agent-2: On t-menu: Its prices are read once, at authoring'
    ]);
  });
});

describe('a UI review taken, its task escalated', () => {
  // Kept taken on a task out of review, its designer was counted at work, and never started fresh, until it came back.
  it('is let go, its designer told — kept as the one before', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    expect((await takeNext(bench.agent('agent-2'), runId, 'designer')).next.designReview?.task.id).toBe('t-menu');

    await escalateReview(bench.agent('test-1'), runId, 't-menu', 'The menu reads two ways');
    const loaded = await loadRun(lead(), runId);
    const { state } = await viewTask(loaded.paths, loaded.tasks.find(task => task.id === 't-menu') ?? loaded.tasks[0]);
    expect(state.design).toMatchObject({ status: 'due', before: 'agent-2' });
    expect(state.design?.by).toBeUndefined();
    const told = (await messagesOf(loaded)).filter(message => message.to === '@agent-2');
    expect(told.map(message => message.text).join(' ')).toContain(
      'escalated t-menu to the lead while you reviewed its UI'
    );
  });
});

describe('a task taken back while a scout’s answer to its block waits', () => {
  // Approved after the cut, the answer took the task for research done: done, with no work in it.
  it('drops the answer, tells the scout, and never closes the task', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan({ ...benchPlan(), designReview: false }))).checked;
    const menu = await take('agent-1', 't-menu');
    await startSpike(menu.ctx, runId, 't-menu', 'which word the original uses for a booking');
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    await answerSpike(bench.agent('scout-1'), runId, 't-menu', '"Reservar"');

    await reassignTask(lead(), runId, 't-menu', { reason: 'Another way in' });
    expect((await nextTask(lead(), runId, 'lead')).proposal).toBeUndefined();
    expect((await refusal(approveSpike(lead(), runId, 't-menu'))).message).toContain('proposes nothing to approve');
    expect((await viewRun(lead(), runId)).tasks.find(task => task.id === 't-menu')?.status).toBe('ready');
    const told = (await messagesOf(await loadRun(lead(), runId))).filter(message => message.to === '@scout-1');
    expect(told.map(message => message.text).join(' ')).toContain('the spike it blocked on ends');
  });
});

describe('a scout at what an agent blocked on', () => {
  // Said only for research, a scout answering a block read as idle on the board and the monitor.
  it('is said to find it out until its answer is with the lead', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan({ ...benchPlan(), designReview: false }))).checked;
    const menu = await take('agent-1', 't-menu');
    await startSpike(menu.ctx, runId, 't-menu', 'which word the original uses for a booking');
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    const line = async () => (await viewRun(lead(), runId)).tasks.find(task => task.id === 't-menu');
    expect((await line())?.spikedBy).toBe('scout-1');

    await answerSpike(bench.agent('scout-1'), runId, 't-menu', '"Reservar"');
    expect((await line())?.spikedBy).toBeUndefined();
  });
});

describe('the keeper, for a review a developer gives', () => {
  // Agents that develop and design are left to the designers' asks: the one that could review was never started.
  it('starts one that may give it, though it designs too', async () => {
    const members = {
      version: 1 as const,
      agents: [
        { name: 'agent', roles: ['developer', 'designer'], count: 2, min: 1 },
        { ...TESTERS, count: 1 }
      ]
    };
    await bench.writeTeam(members);
    const plan: RunPlan = { ...benchPlan(), designReview: false };
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, role: 'tester' } : task));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const tests = await take('test-1', 't-menu');
    await writeInCopy(tests.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(tests.ctx, runId, 't-menu');
    await take('agent-1', 't-home');

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const asked = agentsNeeded(views, startedAgents(members), new Set(['test-1', 'agent-1']), run);
    expect(asked.find(each => each.agent === 'agent-2')?.text).toContain('the review of t-menu');
  });
});
