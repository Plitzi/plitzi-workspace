import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { agentPrompt } from './agentPrompt';
import { amendRun } from './amend';
import { leadItems } from './leadWatch';
import { notLookedAtYet } from './lookedAt';
import { messagesOf } from './messages';
import { agentsNeeded } from './onDemand';
import { loadRun, logRun, openRun } from './run';
import { scopePlan, SCOPE_SPIKE } from './spike';
import { noteRun } from './talk';
import {
  answerSpike,
  approveSpike,
  completeTask,
  escalateReview,
  nextTask,
  reassignTask,
  reviewTask,
  reworkSpike,
  startSpike,
  takeNext,
  unblockTask
} from './tasks';
import { viewTask } from './taskStore';
import { readTeam, setTeamAgent, skillProblems, STARTER_TEAM, startedAgents, teamProblems } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { lookedAt, runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
import type { Team, TeamAgent } from './team';
import type { Bench } from '../tests/runProject';

/**
 * One lead, the manager: testers review every task — the task's approval — a scout finds out the spikes, and the lead
 * decides what is proposed or escalated to it. The lead read 130 turns of ~110k each when it reviewed and scoped, 68% of
 * what a run spent: what reads much is the agents', in fresh contexts (Carlos).
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, take } = runSteps(() => bench);

/** Scripted agents, each one session the test drives: a fresh start between pieces has tests of its own. */
const scripted = (agent: TeamAgent): TeamAgent => ({ ...agent, session: 'keep' });

const team = (...more: TeamAgent[]): Team => ({
  version: 1,
  agents: [scripted({ name: 'agent', roles: ['developer', 'designer'], count: 2 }), ...more.map(scripted)]
});

const TESTERS = { name: 'test', roles: ['tester'], count: 2 };
const SCOUT = { name: 'scout', roles: ['scout'] };

/** A run of the bench's plan — no UI review — with t-menu, then t-home, sent to review. */
const twoInReview = async (members: Team = team(TESTERS)): Promise<{ runId: string }> => {
  const plan: RunPlan = { ...benchPlan(), designReview: false };
  const file = await bench.writePlan(plan);
  await bench.writeTeam(members);
  const { runId } = (await openRun(lead(), file)).checked;
  const menu = await take('agent-1', 't-menu');
  await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
  await completeTask(menu.ctx, runId, 't-menu');
  const home = await take('agent-2', 't-home');
  await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = { title: "Inicio" };\n');
  await completeTask(home.ctx, runId, 't-home');

  return { runId };
};

const statusOf = async (runId: string, taskId: string): Promise<string | undefined> =>
  (await viewRun(lead(), runId)).tasks.find(task => task.id === taskId)?.status;

describe('the team a project starts with', () => {
  // Carlos: one to two developers, and none to one tester, scout and designer — each on demand, on Opus.
  it('starts one developer with the run, and the rest when work waits for them', () => {
    const started = startedAgents(STARTER_TEAM);
    expect(started.map(each => `${each.agent}${each.onDemand ? ' (on demand)' : ''}`)).toEqual([
      'dev-1',
      'dev-2 (on demand)',
      'design-1 (on demand)',
      'test-1 (on demand)',
      'scout-1 (on demand)'
    ]);
    expect(STARTER_TEAM.agents.filter(each => each.name !== 'dev').map(each => each.model)).toEqual([
      'claude-opus-5-5',
      'claude-opus-5-5',
      'claude-opus-5-5'
    ]);
  });

  it('has one lead: a count of leads is refused, saying to add testers', async () => {
    expect(teamProblems({ version: 1, lead: { count: 2 }, agents: [] })).toEqual([
      '"lead": "count" is no field of it (it takes model, effort)'
    ]);
    await bench.writeTeam(team());
    expect((await refusal(setTeamAgent(bench.root, 'lead', { count: 2 }))).message).toContain(
      'more reviewers are more testers'
    );
    // None at the start, every one on demand.
    await setTeamAgent(bench.root, 'test', { roles: ['tester'], min: 0 });
    expect((await readTeam(bench.root))?.agents.find(each => each.name === 'test')).toMatchObject({ min: 0 });
  });
});

describe('a review, a tester’s', () => {
  it('offers each tester a review no other took, and holds it to the one that took it', async () => {
    const { runId } = await twoInReview();
    const first = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.leadReview?.task.id ?? '';
    const second = (await takeNext(bench.agent('test-2'), runId, 'tester')).next.leadReview?.task.id ?? '';
    expect([first, second].sort()).toEqual(['t-home', 't-menu']);

    const claimed = await refusal(reviewTask(bench.agent('test-2'), runId, first, 'approve', []));
    expect(claimed.code).toBe('claimed');

    expect(await reviewTask(bench.agent('test-1'), runId, first, 'approve', [])).toMatchObject({ verdict: 'approve' });
    // The lead has the last word on any.
    expect(await reviewTask(lead(), runId, second, 'approve', [])).toMatchObject({ verdict: 'approve' });
  });

  it('reviews a designer’s task too: its QA', async () => {
    const plan: RunPlan = { ...benchPlan(), designReview: false };
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, role: 'designer' } : task));
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    expect((await takeNext(bench.agent('test-1'), runId, 'tester')).next.leadReview?.task.id).toBe('t-menu');
  });

  it('wakes the lead for no review while testers review — and for each, with none', async () => {
    const { runId } = await twoInReview();
    const reviews = (items: { key: string }[]) => items.filter(item => item.key.startsWith('review:'));
    expect(reviews(leadItems(await viewRun(lead(), runId)))).toEqual([]);

    await bench.writeTeam(team());
    expect(reviews(leadItems(await viewRun(lead(), runId))).map(item => item.key)).toEqual([
      expect.stringContaining('review:t-home:'),
      expect.stringContaining('review:t-menu:')
    ]);
    // With no tester, the lead's queue hands it the reviews.
    expect((await nextTask(lead(), runId, 'lead')).leadReview?.task.id).toMatch(/t-(home|menu)/);
  });

  it('leaves the plan, the notes and a reassignment the lead’s', async () => {
    const { runId } = await twoInReview();
    const file = await bench.writePlan({ ...benchPlan(), designReview: false });
    // One at a time, each awaited as it starts: begun together, a refusal not yet awaited went unhandled.
    for (const work of [
      () => amendRun(bench.agent('test-1'), runId, file),
      () => noteRun(bench.agent('test-1'), runId, 'Use the formal voice'),
      () => reassignTask(bench.agent('test-1'), runId, 't-book')
    ]) {
      expect((await refusal(work())).code).toBe('lead-only');
    }

    const refused = await refusal(reviewTask(bench.agent('agent-1'), runId, 't-home', 'approve', []));
    expect(refused.code).toBe('lead-only');
    expect(refused.message).toContain('test-1, test-2, lead');
  });
});

describe('a UI no designer is free for', () => {
  it('is reviewed by the tester too, as it says: --skip-design reviewer, after its look', async () => {
    const plan: RunPlan = { ...benchPlan(), designReview: true };
    plan.tasks = plan.tasks.map(task => (task.id === 't-home' ? { ...task, role: 'designer' } : task));
    // Its one designer, at a task of its own: the UI review waits for nobody.
    await bench.writeTeam({
      version: 1,
      agents: [
        scripted({ name: 'agent', roles: ['developer'], count: 2 }),
        scripted({ name: 'design', roles: ['designer'] }),
        scripted({ ...TESTERS, count: 1 })
      ]
    });
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await take('design-1', 't-home');
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const offered = await takeNext(bench.agent('test-1'), runId, 'tester');
    expect(offered.next.leadReview).toMatchObject({ task: { id: 't-menu' } });
    expect(offered.next.leadReview?.uiToo).toContain('--skip-design test-1');
    expect(
      (
        await refusal(
          reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', [], 'refuse', { skipDesign: 'reviewer' })
        )
      ).message
    ).toContain('plitzi task look t-menu');
    await lookedAt(bench.agent('test-1'), runId, 't-menu');
    expect(
      await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', [], 'refuse', { skipDesign: 'reviewer' })
    ).toMatchObject({ verdict: 'approve', design: 'skipped', designSkip: 'reviewer' });
  });
});

describe('a role of the project’s own', () => {
  it('names the skill its agents read first, a markdown file the project has', async () => {
    await bench.writeTeam(team());
    expect(
      (await refusal(setTeamAgent(bench.root, 'a11y', { roles: ['accessibility'], skill: '/etc/role.md' }))).message
    ).toContain('its skill is a markdown file of the project');
    await setTeamAgent(bench.root, 'a11y', { roles: ['accessibility'], skill: '.claude/skills/a11y/SKILL.md' });
    const members = (await readTeam(bench.root)) ?? team();
    expect(startedAgents(members).find(each => each.agent === 'a11y-1')).toMatchObject({
      skill: '.claude/skills/a11y/SKILL.md'
    });
    expect(
      agentPrompt({
        agent: 'a11y-1',
        started: { roles: ['accessibility'], skill: '.claude/skills/a11y/SKILL.md' },
        runId: 'es-launch',
        root: bench.root,
        cli: 'plitzi',
        goal: 'An accessible site'
      })
    ).toContain(`${bench.root}/.claude/skills/a11y/SKILL.md`);

    // Named and not there, the plan is refused: an agent would start reading nothing.
    expect(await skillProblems(bench.root, members)).toEqual([
      expect.stringContaining('"a11y" reads .claude/skills/a11y/SKILL.md first') as unknown
    ]);
    await writeInCopy(bench.root, '.claude/skills/a11y/SKILL.md', '# Accessibility\n');
    expect(await skillProblems(bench.root, members)).toEqual([]);
  });
});

describe('a review a tester cannot decide', () => {
  it('goes to the lead, blocked on it, who decides it', async () => {
    const { runId } = await twoInReview();
    const offered = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.leadReview?.task.id ?? '';
    await escalateReview(bench.agent('test-1'), runId, offered, 'The acceptance reads two ways: the title or the menu');

    const loaded = await loadRun(lead(), runId);
    const state = (await viewTask(loaded.paths, loaded.tasks.find(task => task.id === offered) ?? loaded.tasks[0]))
      .state;
    expect(state).toMatchObject({ status: 'blocked', blockedBy: { needs: 'lead', review: true } });
    expect((await messagesOf(loaded)).at(-1)?.text).toContain('escalates its review');
    // No other tester is offered it: it is the lead's now.
    expect((await nextTask(bench.agent('test-2'), runId, 'tester')).leadReview?.task.id).not.toBe(offered);

    await reviewTask(lead(), runId, offered, 'approve', []);
    expect(await statusOf(runId, offered)).toBe('done');
  });

  it('is the lead’s to decide, never to escalate', async () => {
    const { runId } = await twoInReview();
    expect((await refusal(escalateReview(lead(), runId, 't-menu', 'unclear'))).message).toContain('You are the lead');
  });
});

describe('a task the lead wrote', () => {
  it('is reviewed by a tester: the lead is refused its own', async () => {
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan({ ...benchPlan(), designReview: false }))).checked;
    const { taken } = await reassignTask(lead(), runId, 't-menu', { to: 'lead' });
    if (!taken) {
      throw new Error('the lead took no copy of t-menu');
    }

    await writeInCopy(taken.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(bench.agent('lead', { token: taken.token }), runId, 't-menu');
    expect((await refusal(reviewTask(lead(), runId, 't-menu', 'approve', []))).message).toContain(
      'is yours: another reviews it'
    );

    await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []);
    expect(await statusOf(runId, 't-menu')).toBe('done');
  });

  // The lead approved what test-1 was reviewing; the copy went under it, and its verdict was refused.
  it('tells a tester its review ends when the lead decides it meanwhile', async () => {
    const { runId } = await twoInReview();
    const offered = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.leadReview?.task.id ?? '';
    await reviewTask(lead(), runId, offered, 'approve', []);
    const told = (await messagesOf(await loadRun(lead(), runId))).filter(message => message.to === '@test-1');
    expect(told.map(message => message.text).join(' ')).toContain(
      `decided ${offered} (approved) while you reviewed it`
    );
  });
});

describe('a spike, a scout’s', () => {
  const scopeTasks = async (): Promise<string> => {
    const plan = { ...benchPlan(), runId: 'es-scope', goal: 'The scope’s tasks' };

    return bench.writePlan({ ...plan, tasks: plan.tasks.slice(0, 2) });
  };

  it('finds out the scope and proposes its tasks, which the lead approves — or sends back — with the person', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site'))))
      .checked;

    const offered = await takeNext(bench.agent('scout-1'), runId, 'scout');
    expect(offered.next.spike).toMatchObject({ task: { id: SCOPE_SPIKE } });
    // Its own from now: the lead, with a scout in the team, is handed no spike to find out.
    expect((await nextTask(lead(), runId, 'lead')).spike).toBeUndefined();

    const proposed = await answerSpike(bench.agent('scout-1'), runId, SCOPE_SPIKE, 'Two pages to translate', {
      tasks: await scopeTasks()
    });
    expect(proposed).toMatchObject({ status: 'spike', proposed: ['t-home', 't-menu'] });
    // Nothing stacked until the lead says.
    expect((await viewRun(lead(), runId)).tasks.map(task => task.id)).toEqual([SCOPE_SPIKE]);
    expect((await nextTask(lead(), runId, 'lead')).proposal).toMatchObject({
      task: { id: SCOPE_SPIKE },
      by: 'scout-1',
      tasks: ['t-home', 't-menu']
    });

    await reworkSpike(lead(), runId, SCOPE_SPIKE, 'Leave the menu for later');
    expect((await nextTask(bench.agent('scout-1'), runId, 'scout')).spike).toMatchObject({
      task: { id: SCOPE_SPIKE },
      asked: 'Leave the menu for later'
    });
    await answerSpike(bench.agent('scout-1'), runId, SCOPE_SPIKE, 'Home first', { tasks: await scopeTasks() });

    expect(await approveSpike(lead(), runId, SCOPE_SPIKE)).toMatchObject({
      status: 'done',
      added: ['t-home', 't-menu']
    });
    expect(await statusOf(runId, 't-home')).toBe('ready');
  });

  it('answers a question an agent blocked on, lifting its block', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan({ ...benchPlan(), designReview: false }))).checked;
    const menu = await take('agent-1', 't-menu');
    await startSpike(menu.ctx, runId, 't-menu', 'which word the original uses for a booking');

    expect((await takeNext(bench.agent('scout-1'), runId, 'scout')).next.spike).toMatchObject({
      task: { id: 't-menu' },
      blocking: true,
      question: 'which word the original uses for a booking'
    });
    await unblockTask(bench.agent('scout-1'), runId, 't-menu', '"Reservar", never "Reserva"');
    expect(await statusOf(runId, 't-menu')).toBe('in-progress');
  });
});

describe('agents on demand', () => {
  it('asks for a tester when a review waits, and a scout when a spike does', async () => {
    const members = {
      version: 1 as const,
      agents: [
        { name: 'agent', roles: ['developer'] },
        { ...TESTERS, count: 1, min: 0 },
        { ...SCOUT, min: 0 }
      ]
    };
    const { runId } = await twoInReview({
      ...members,
      agents: [{ ...members.agents[0], count: 2 }, ...members.agents.slice(1)]
    });
    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const run = { identified: [], scratch: loaded.paths.scratch, openFor: 0, open: true, launches: true };
    const started = startedAgents((await readTeam(bench.root)) ?? members);
    const asked = agentsNeeded(views, started, new Set(['agent-1', 'agent-2']), run);
    expect(asked.map(each => each.agent)).toContain('test-1');
    expect(asked.find(each => each.agent === 'test-1')?.text).toContain('the review of t-');
  });
});

describe('the lead’s look at the whole result', () => {
  it('is asked for after the last approval, once testers approved the tasks', async () => {
    const { runId } = await twoInReview();
    const loaded = await loadRun(lead(), runId);
    expect(await notLookedAtYet(lead(), loaded)).toBe(false);

    await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', []);
    expect(await notLookedAtYet(lead(), loaded)).toBe(true);
    await logRun(lead(), loaded.paths, { action: 'run-look', pages: ['/menu'], passed: true });
    expect(await notLookedAtYet(lead(), loaded)).toBe(false);
  });
});
