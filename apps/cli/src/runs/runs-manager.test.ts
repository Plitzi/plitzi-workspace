import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bottlenecks } from './bottlenecks';
import { extendRun } from './extend';
import { leadItems } from './leadWatch';
import { agentsNeeded } from './onDemand';
import { copyRunWork } from './preview';
import { checkPlanFile, loadRun, logRun, openRun, readRunLog } from './run';
import { askLead, messageTasks, tellLeadAbout } from './talk';
import { completeTask, escalateReview, nextTask, reviewTask, takeNext, unblockTask } from './tasks';
import { viewTask } from './taskStore';
import { readTeam, startedAgents } from './team';
import { viewRun } from './view';
import { researchSteps } from '../tests/research';
import { reviewerSteps, SCOUT, team, TESTERS } from '../tests/reviewerSteps';
import { benchPlan, designed, makeBench, writeInCopy } from '../tests/runProject';
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
const { found, approveFound } = researchSteps(() => bench);
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
    const plan: RunPlan = benchPlan();
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, role: 'tester' } : task));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const taken = await take('test-1', 't-menu');
    await writeInCopy(taken.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(taken.ctx, runId, 't-menu');

    expect((await nextTask(bench.agent('test-1'), runId, 'tester')).review).toBeUndefined();
    expect((await nextTask(lead(), runId, 'lead')).review).toBeUndefined();
    expect(leadItems(await viewRun(lead(), runId)).filter(item => item.key.startsWith('review:t-menu:'))).toEqual([]);
    expect((await viewRun(lead(), runId)).tasks.find(task => task.id === 't-menu')?.review?.reviewers).toEqual([
      'dev-1',
      'dev-2'
    ]);
    // Neither running: one is started for it.
    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const asked = agentsNeeded(views, startedAgents(members), new Set(['test-1']), run);
    expect(asked.find(each => each.agent === 'dev-1')?.text).toContain(
      "the tester's review of t-menu wait for a developer"
    );

    expect((await takeNext(bench.agent('dev-1'), runId, 'developer')).next.review?.task.id).toBe('t-menu');
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
    const plan: RunPlan = benchPlan();
    const home = plan.tasks.find(task => task.id === 't-home') ?? plan.tasks[0];
    plan.tasks = [
      { ...home, tests: false },
      {
        ...home,
        id: 't-home-tests',
        title: 'Tests of the home',
        role: 'tester',
        files: ['src/lib/homeChecks.ts'],
        dependsOn: ['t-home'],
        testsOf: ['t-home']
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

    expect((await nextTask(bench.agent('dev-1'), runId, 'developer')).review).toBeUndefined();
    const woken = leadItems(await viewRun(lead(), runId)).filter(item => item.key.startsWith('review:t-home-tests:'));
    expect(woken.map(item => item.text)).toEqual([expect.stringContaining('nobody else may')]);
    expect((await nextTask(lead(), runId, 'lead')).review?.task.id).toBe('t-home-tests');

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
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
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
    const plan: RunPlan = benchPlan();
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
    const offered = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.review?.task.id ?? '';
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
    // And what the lead said to it: encore-10's tester sent back a task for a question the lead had answered.
    await messageTasks(lead(), runId, 't-menu', 'Keep the euro sign after the price');
    const offers = [
      (await takeNext(bench.agent('test-1'), runId, 'tester')).next.review,
      (await takeNext(bench.agent('test-2'), runId, 'tester')).next.review
    ];
    expect(offers.find(offer => offer?.task.id === 't-menu')?.told).toEqual([
      'agent-2 to the lead: On t-menu: Its prices are read once, at authoring',
      'the lead to it: Keep the euro sign after the price'
    ]);
  });
});

describe('a step taken, its task escalated', () => {
  // Kept taken on a task out of review, its designer was counted at work, and never started fresh, until it came back.
  it('is let go — its reviewer kept as the one before', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(designed(benchPlan())))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    expect((await takeNext(bench.agent('agent-2'), runId, 'designer')).next.review?.task.id).toBe('t-menu');

    await escalateReview(bench.agent('agent-2'), runId, 't-menu', 'The menu reads two ways');
    const loaded = await loadRun(lead(), runId);
    const { state } = await viewTask(loaded.paths, loaded.tasks.find(task => task.id === 't-menu') ?? loaded.tasks[0]);
    expect(state.review).toMatchObject({ step: 0, before: ['agent-2'] });
    expect(state.review?.by).toBeUndefined();
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
    const plan: RunPlan = benchPlan();
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
    expect(asked.find(each => each.agent === 'agent-2')?.text).toContain("the tester's review of t-menu");
  });
});

describe('an agent asking with no role', () => {
  // A run's design-1 read "nothing ready for a undefined": the roles are the team's for it.
  it('is told what is ready for others by the roles the team gives it', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const next = await nextTask(bench.agent('test-1'), runId);
    // A tester's work is the reviews coming: what the developers work comes to it in review.
    expect(next.why).toContain('no task is left for a tester to work');
    expect(next.why).toContain('yours to review once in review');
  });
});

describe('the keeper, for a task of tests', () => {
  // dev-1, free, wrote what t-about-tests tests: counted free for it, nobody was started.
  it('starts a developer that may write it, its author free or not', async () => {
    const members = {
      version: 1 as const,
      agents: [
        { name: 'dev', roles: ['developer'], count: 2, min: 1 },
        { ...TESTERS, count: 1 }
      ]
    };
    await bench.writeTeam(members);
    await bench.write(
      'package.json',
      JSON.stringify({
        name: 'bench',
        type: 'module',
        private: true,
        devDependencies: { '@playwright/test': '^1.56.1' }
      })
    );
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const about = await take('dev-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const page = { es: true };\n');
    await completeTask(about.ctx, runId, 't-about');
    await reviewTask(bench.agent('test-1'), runId, 't-about', 'approve', []);

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const asked = agentsNeeded(views, startedAgents(members), new Set(['dev-1', 'test-1']), run);
    expect(asked.find(each => each.agent === 'dev-2')?.text).toContain('t-about-tests');
  });
});

describe('a spike while its scout is between pieces', () => {
  // encore-10's lead was told "yours to find out (the team has no scout)" while scout-1 stood stopped for a fresh context.
  it('is never the lead’s for want of a scout running: the team has one', async () => {
    const plan: RunPlan = benchPlan();
    plan.tasks = [
      ...plan.tasks,
      { ...plan.tasks[0], id: 's-words', title: 'The words', files: [], spike: 'which words' }
    ];
    const members = team({ ...SCOUT, min: 0 });
    await bench.writeTeam(members);
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const all = startedAgents(members);
    const running = all.filter(each => !each.roles.includes('scout'));

    expect(bottlenecks(views, running, bench.now(), [], all).map(each => each.kind)).not.toContain('spikes');
    expect(bottlenecks(views, running, bench.now(), [], running).map(each => each.kind)).toContain('spikes');
  });
});

describe('a research spike in a plan', () => {
  // encore-10's stage of one spike was told it "gets no task of tests" and that "no line has a check": research writes
  // nothing and ends by its findings.
  it('is told nothing of tests nor checks', async () => {
    await bench.writeTeam(team(TESTERS));
    const plan: RunPlan = benchPlan();
    plan.tasks = [
      ...plan.tasks,
      { ...plan.tasks[0], id: 's-words', title: 'The words', files: [], spike: 'which words', estimateMinutes: 10 }
    ];
    const { notices } = await checkPlanFile(lead(), await bench.writePlan(plan));
    expect(notices.filter(notice => notice.includes('s-words'))).toEqual([]);
  });
});

describe('a task that holds its own test file', () => {
  // encore-10's t-visual-show-soon held shows.test.ts and was told "its test files are another task's".
  it('is told it writes its tests itself', async () => {
    await bench.writeTeam(team(TESTERS));
    const plan: RunPlan = benchPlan();
    plan.tasks = [
      { ...plan.tasks[0], id: 't-shows', files: ['src/functions/shows.ts', 'src/functions/shows.test.ts'] }
    ];
    const { notices } = await checkPlanFile(lead(), await bench.writePlan(plan));
    const said = notices.find(notice => notice.includes('"t-shows"')) ?? '';
    expect(said).toContain('it writes its tests itself (src/functions/shows.test.ts)');
    expect(said).not.toContain("another task's");
  });
});

describe('a research spike that depends on a task', () => {
  // encore-10's s-suite-failures was handed to its scout while t-visual-specs, its dependency, was still in review.
  it('waits pending until that task is approved, then is a spike to find out', async () => {
    const { runId } = await twoInReview();
    const stage = path.join(bench.root, 'tmp', 'stage.json');
    await fs.writeFile(
      stage,
      JSON.stringify({
        tasks: [
          {
            id: 's-after-menu',
            title: 'What the menu left',
            files: [],
            dependsOn: ['t-menu'],
            priority: 'high',
            estimateMinutes: 20,
            acceptance: ['What remains, found'],
            spike: 'what the menu left'
          }
        ]
      })
    );
    await extendRun(lead(), runId, stage);
    const status = async () => (await viewRun(lead(), runId)).tasks.find(task => task.id === 's-after-menu')?.status;
    expect(await status()).toBe('pending');

    await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []);
    expect(await status()).toBe('ready');
  });
});

describe('a scout at its research card', () => {
  // encore-10's watch said test-1 held a review "while scout-1 has nothing to take", scout-1 at s-suite-failures.
  it('is never told free beside a review that drags: it is at work', async () => {
    const plan: RunPlan = benchPlan();
    const menu0 = plan.tasks.find(task => task.id === 't-menu') ?? plan.tasks[0];
    // Nothing else ready: the drag is what holds the run.
    plan.tasks = [menu0, { ...menu0, id: 's-words', title: 'The words', files: [], spike: 'which words' }];
    const members = team({ ...TESTERS, count: 1 }, { ...SCOUT, min: 0 });
    await bench.writeTeam(members);
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await takeNext(bench.agent('test-1'), runId, 'tester');
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    bench.advance(5 * 60_000);

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const all = startedAgents(members).filter(each => each.agent !== 'agent-2');
    const said = bottlenecks(views, all, bench.now(), [], all)
      .map(each => each.text)
      .join(' ');
    // Free, in the drag's words, are those at nothing: never the scout at its research.
    expect(said).toMatch(/nothing to take/);
    expect(said).not.toMatch(/while [^:]*scout-1[^:]*nothing to take/);
  });
});

describe('a scout’s result the lead approves without its tasks', () => {
  // encore-10's lead sent s-suite-failures back to end it alone, and its scout read "say it again".
  it('is done with its findings, the tasks left out and said', async () => {
    await bench.writeTeam(team({ ...SCOUT, min: 0 }));
    const plan: RunPlan = benchPlan();
    plan.tasks = [
      plan.tasks[0],
      { ...plan.tasks[0], id: 's-words', title: 'The words', files: [], spike: 'which words', estimateMinutes: 10 }
    ];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    const stage = path.join(bench.root, 'tmp', 'words.json');
    await fs.mkdir(path.dirname(stage), { recursive: true });
    await fs.writeFile(
      stage,
      JSON.stringify({
        tasks: [
          { ...plan.tasks[0], id: 't-words', title: 'The words', files: ['src/space/pages/about.ts'], dependsOn: [] }
        ]
      })
    );
    await found(runId, 's-words', '"Reservar"', { tasks: stage });

    const done = await approveFound(runId, 's-words', 'all');
    expect(done.found).toMatchObject({ added: [], left: ['t-words'] });
    expect((await loadRun(lead(), runId)).tasks.map(task => task.id)).not.toContain('t-words');
  });
});

describe('research taken by its scout', () => {
  // encore-10's spike on the suite's speed was told to compare with an original the run had none of.
  it('names the original only when the run copies one', async () => {
    await bench.writeTeam(team({ ...SCOUT, min: 0 }));
    const plan: RunPlan = { ...benchPlan(), reference: 'https://example.com' };
    plan.tasks = [
      { ...plan.tasks[0], id: 's-words', title: 'The words', files: [], spike: 'which words', estimateMinutes: 10 }
    ];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    expect((await takeNext(bench.agent('scout-1'), runId, 'scout')).taken?.reference).toBe('https://example.com');
  });
});

describe('a task of tests behind the task it tests', () => {
  // encore-10's watch told the lead to take t-visual-own-state away from its tests' dependencies, its review going on.
  it('is never held up: it waits for what it tests by what it is', async () => {
    const plan: RunPlan = benchPlan();
    const menu0 = plan.tasks.find(task => task.id === 't-menu') ?? plan.tasks[0];
    plan.tasks = [
      menu0,
      {
        ...menu0,
        id: 't-menu-tests',
        title: 'Tests for t-menu',
        files: ['src/lib/menuChecks.ts'],
        dependsOn: ['t-menu'],
        testsOf: ['t-menu']
      }
    ];
    const members = team({ ...TESTERS, count: 1 });
    await bench.writeTeam(members);
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const all = startedAgents(members);
    expect(bottlenecks(views, all, bench.now(), [], all).map(each => each.kind)).not.toContain('held-up');
  });
});

describe('the run’s work, copied for a spike', () => {
  // encore-10's scout rebuilt the run's approved work by hand — approved.json, then each blob — to measure apart.
  it('is a folder of the caller’s scratch with every approved file, and never outside the project', async () => {
    await bench.writeTeam(team({ ...TESTERS, count: 1 }, { ...SCOUT, min: 0 }));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Carta" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []);

    const copied = await copyRunWork(bench.agent('scout-1'), runId);
    expect(copied.dir).toContain(path.join('scratch', 'scout-1', 'run-copy'));
    expect(await fs.readFile(path.join(copied.dir, 'src/space/pages/menu.ts'), 'utf-8')).toContain('Carta');
    expect((await refusal(copyRunWork(bench.agent('scout-1'), runId, '/tmp/elsewhere'))).message).toContain(
      'is not inside the project'
    );
  });
});
