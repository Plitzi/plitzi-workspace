import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { agentPrompt } from './agentPrompt';
import { amendRun } from './amend';
import { bottlenecks } from './bottlenecks';
import { extendRun } from './extend';
import { leadItems } from './leadWatch';
import { notLookedAtYet } from './lookedAt';
import { messagesOf, openQuestions, unreadFor } from './messages';
import { agentsNeeded } from './onDemand';
import { REVIEW_QUEUE_MS, takeOnLook } from './reviews';
import { loadRun, logRun, openRun } from './run';
import { scopePlan, SCOPE_SPIKE } from './spike';
import { messageTasks, noteRun } from './talk';
import {
  blockTask,
  completeResearch,
  completeTask,
  escalateReview,
  findTask,
  nextTask,
  reassignTask,
  reviewTask,
  seeProposal,
  takeNext,
  unblockTask
} from './tasks';
import { viewTask } from './taskStore';
import { readTeam, setTeamAgent, skillProblems, STARTER_TEAM, startedAgents, teamProblems } from './team';
import { viewRun } from './view';
import { startLines } from '../commands/runs/plan';
import { researchSteps } from '../tests/research';
import { reviewerSteps, SCOUT, scripted, team, TESTERS } from '../tests/reviewerSteps';
import { benchPlan, designed, makeBench, provenPlan, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunPlan } from './model';
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
const { found, approveFound, sendBack } = researchSteps(() => bench);

const { twoInReview } = reviewerSteps(() => bench);

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
    const first = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.review?.task.id ?? '';
    const second = (await takeNext(bench.agent('test-2'), runId, 'tester')).next.review?.task.id ?? '';
    expect([first, second].sort()).toEqual(['t-home', 't-menu']);

    const claimed = await refusal(reviewTask(bench.agent('test-2'), runId, first, 'approve', []));
    expect(claimed.code).toBe('claimed');

    expect(await reviewTask(bench.agent('test-1'), runId, first, 'approve', [])).toMatchObject({ verdict: 'approve' });
    // The lead has the last word on any.
    expect(await reviewTask(lead(), runId, second, 'approve', [])).toMatchObject({ verdict: 'approve' });
  });

  // A run's test-1 was refused a verdict on t-closed-room for the lead's note on another card, and sent it twice.
  it('holds a verdict for what the lead said about it, or about no card — never for a note on another card', async () => {
    const { runId } = await twoInReview();
    const taken = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.review?.task.id ?? '';
    const other = taken === 't-menu' ? 't-home' : 't-menu';

    await messageTasks(lead(), runId, '@test-1', `When you review ${other}: its title wraps at 390`);
    await messageTasks(lead(), runId, '@test-1', `On ${taken}: the date is UTC, say it`);
    const held = await refusal(reviewTask(bench.agent('test-1'), runId, taken, 'approve', []));
    expect(held.message).toContain(`On ${taken}: the date is UTC`);
    expect(held.message).not.toContain(other);

    await messageTasks(lead(), runId, '@test-1', 'Keep each note short');
    expect((await refusal(reviewTask(bench.agent('test-1'), runId, taken, 'approve', []))).message).toContain(
      'Keep each note short'
    );
    expect(await reviewTask(bench.agent('test-1'), runId, taken, 'approve', [])).toMatchObject({ verdict: 'approve' });
    // The note on the other card is still the agent's to read: handed over with its next command.
    const unread = await unreadFor(await loadRun(lead(), runId), '@test-1', false);
    expect(unread.map(message => message.text)).toEqual([`When you review ${other}: its title wraps at 390`]);
  });

  it('reviews a designer’s task too: its QA', async () => {
    const plan: RunPlan = benchPlan();
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, role: 'designer' } : task));
    await bench.writeTeam(team(TESTERS));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');

    expect((await takeNext(bench.agent('test-1'), runId, 'tester')).next.review?.task.id).toBe('t-menu');
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
    expect((await nextTask(lead(), runId, 'lead')).review?.task.id).toMatch(/t-(home|menu)/);
  });

  it('leaves the plan, the notes and a reassignment the lead’s', async () => {
    const { runId } = await twoInReview();
    const file = await bench.writePlan(benchPlan());
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
    expect(refused.message).toContain('test-1, test-2 says it, or the lead');
  });
});

describe('a designer’s step nobody takes in time', () => {
  it('is the next step’s reviewer’s too: the tester says it, then its own', async () => {
    const plan = designed(benchPlan());
    plan.tasks = plan.tasks.map(task => (task.id === 't-home' ? { ...task, role: 'designer' } : task));
    // Its one designer, at a task of its own: the designer's step waits for nobody past its queue's time.
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

    expect((await nextTask(bench.agent('test-1'), runId, 'tester')).review).toBeUndefined();
    bench.advance(REVIEW_QUEUE_MS);
    const offered = await takeNext(bench.agent('test-1'), runId, 'tester');
    expect(offered.next.review).toMatchObject({ task: { id: 't-menu' }, role: 'designer' });
    expect(await reviewTask(bench.agent('test-1'), runId, 't-menu', 'approve', [])).toMatchObject({
      passed: { role: 'designer', next: 'tester' }
    });
    expect((await takeNext(bench.agent('test-1'), runId, 'tester')).next.review).toMatchObject({ role: 'tester' });
  });
});

describe('a tester’s look at a card whose designer’s step waits', () => {
  it('takes no step a designer is free for', async () => {
    await bench.writeTeam({
      version: 1,
      agents: [
        scripted({ name: 'agent', roles: ['developer'], count: 2 }),
        scripted({ name: 'design', roles: ['designer'] }),
        scripted({ ...TESTERS, count: 1 })
      ]
    });
    const { runId } = (await openRun(lead(), await bench.writePlan(designed(benchPlan())))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(menu.ctx, runId, 't-menu');

    const loaded = await loadRun(lead(), runId);
    const view = await viewTask(loaded.paths, loaded.tasks.find(task => task.id === 't-menu') ?? loaded.tasks[0]);
    expect(await takeOnLook(bench.agent('test-1'), loaded, view)).toBe(false);
    expect((await viewTask(loaded.paths, view.task)).state.review?.by).toBeUndefined();
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
    const offered = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.review?.task.id ?? '';
    await escalateReview(bench.agent('test-1'), runId, offered, 'The acceptance reads two ways: the title or the menu');

    const loaded = await loadRun(lead(), runId);
    const state = (await viewTask(loaded.paths, loaded.tasks.find(task => task.id === offered) ?? loaded.tasks[0]))
      .state;
    expect(state).toMatchObject({ status: 'blocked', blockedBy: { needs: 'lead', review: true } });
    expect(state.blockedBy?.reason).toContain('escalated by test-1: The acceptance reads two ways');
    // The block wakes the lead, once: no message beside it to answer.
    expect(
      (await viewRun(lead(), runId)).attention.filter(item => item.task === offered).map(item => item.kind)
    ).toEqual(['blocked']);
    // No other tester is offered it: it is the lead's now.
    expect((await nextTask(bench.agent('test-2'), runId, 'tester')).review?.task.id).not.toBe(offered);

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
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
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
    const offered = (await takeNext(bench.agent('test-1'), runId, 'tester')).next.review?.task.id ?? '';
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

    return bench.writePlan(provenPlan({ ...plan, tasks: plan.tasks.slice(0, 2) }));
  };

  it('finds out the scope and proposes its tasks, which the lead approves — or sends back — with the person', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site'))))
      .checked;

    const offered = await takeNext(bench.agent('scout-1'), runId, 'scout');
    expect(offered.taken?.task.id).toBe(SCOPE_SPIKE);
    // Its own from now: the lead, with a scout in the team, is handed nothing to find out.
    expect((await nextTask(lead(), runId, 'lead')).spike).toBeUndefined();

    const proposed = await found(runId, SCOPE_SPIKE, 'Two pages to translate', { tasks: await scopeTasks() });
    expect(proposed).toMatchObject({ status: 'in-review', proposed: ['t-home', 't-menu'] });
    // Nothing stacked until the lead says.
    expect((await viewRun(lead(), runId)).tasks.map(task => task.id)).toEqual([SCOPE_SPIKE]);
    expect((await nextTask(lead(), runId, 'lead')).review?.found).toMatchObject({
      by: 'scout-1',
      tasks: ['t-home', 't-menu']
    });

    await sendBack(runId, SCOPE_SPIKE, 'Leave the menu for later');
    const again = await nextTask(bench.agent('scout-1'), runId, 'scout');
    expect(again).toMatchObject({ task: { id: SCOPE_SPIKE }, yours: 'changes-requested' });
    expect(again.asked?.join(' ')).toContain('Leave the menu for later');
    await found(runId, SCOPE_SPIKE, 'Home first', { tasks: await scopeTasks() });

    // The lead leaves the menu out: what it proposed, but that, is stacked.
    expect((await approveFound(runId, SCOPE_SPIKE, ['t-menu'])).found).toMatchObject({
      added: ['t-home'],
      left: ['t-menu']
    });
    expect(await statusOf(runId, SCOPE_SPIKE)).toBe('done');
    expect(await statusOf(runId, 't-home')).toBe('ready');
  });

  // Every spike is the lead's to approve: what is found mostly becomes the work it manages (Carlos).
  // Carlos: the scout finds out the run's spikes alone — an agent's question is the lead's, and with no spike left the
  // scout's part ends.
  it('leaves an agent’s question to the lead, and stops once no research is left', async () => {
    await bench.writeTeam(team({ ...SCOUT, min: 0 }));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const menu = await take('agent-1', 't-menu');
    await blockTask(menu.ctx, runId, 't-menu', 'which word the original uses for a booking', 'lead');
    expect((await viewRun(lead(), runId)).attention.find(item => item.task === 't-menu')).toMatchObject({
      kind: 'blocked',
      who: 'lead'
    });

    const scouting = await nextTask(bench.agent('scout-1'), runId, 'scout');
    expect(scouting.task).toBeUndefined();
    expect(scouting.finished).toBe(true);
    expect((await refusal(completeResearch(bench.agent('scout-1'), runId, 't-menu', 'Reservar'))).message).toContain(
      'is no research card'
    );

    expect((await nextTask(lead(), runId, 'lead')).spike).toMatchObject({ task: { id: 't-menu' }, blocking: true });
    await unblockTask(lead(), runId, 't-menu', '"Reservar", never "Reserva"');
    expect(await statusOf(runId, 't-menu')).toBe('in-progress');
    const loaded = await loadRun(lead(), runId);
    const state = (await viewTask(loaded.paths, loaded.tasks.find(task => task.id === 't-menu') ?? loaded.tasks[0]))
      .state;
    expect(state.findings).toEqual([expect.objectContaining({ by: 'lead', text: '"Reservar", never "Reserva"' })]);

    // Answered by its block, no question left open: its approval is not held (a message beside it was never answered).
    expect(await openQuestions(loaded)).toEqual([]);
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = { title: "Reservar" };\n');
    // Its answer unread, the task does not go to review: handed over by the refusal, read, the next complete goes on.
    expect((await refusal(completeTask(menu.ctx, runId, 't-menu'))).message).toContain(
      'The lead told t-menu what was not read yet'
    );
    await completeTask(menu.ctx, runId, 't-menu');
    // The team has no tester: the lead reviews.
    expect(await reviewTask(lead(), runId, 't-menu', 'approve', [])).toMatchObject({ verdict: 'approve' });
  });

  it('proposes findings alone too: nothing is done until the lead approves it', async () => {
    const plan: RunPlan = benchPlan();
    plan.tasks.push({
      id: 's-words',
      title: 'Which words the original uses',
      files: [],
      dependsOn: [],
      priority: 'high',
      estimateMinutes: 10,
      acceptance: ['Says each word'],
      spike: 'which words the original uses'
    });
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    expect(await found(runId, 's-words', 'Reservar, Carta')).toMatchObject({ status: 'in-review', proposed: [] });
    expect(await statusOf(runId, 's-words')).toBe('in-review');
    expect(await approveFound(runId, 's-words')).toMatchObject({ verdict: 'approve', found: { added: [], left: [] } });
    expect(await statusOf(runId, 's-words')).toBe('done');
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
    expect(asked.find(each => each.agent === 'test-1')?.text).toContain('review of t-');
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

describe('the run’s tasks, the lead’s alone', () => {
  // Carlos: adding or taking out tasks is the lead's — a scout's stage is a proposal it approves.
  it('refuses a scout a stage stacked, and stacks it only as a proposal the lead approves', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    const stage = await bench.writePlan({
      ...benchPlan(),
      runId: 'more',
      tasks: [{ ...benchPlan().tasks[0], id: 't-more', files: ['src/space/pages/extra.ts'], dependsOn: [] }]
    });
    expect((await refusal(extendRun(bench.agent('scout-1'), runId, stage))).code).toBe('lead-only');
    expect((await refusal(extendRun(bench.agent('scout-1'), runId, stage, { dryRun: true }))).code).toBe('lead-only');
  });

  // A run's and a run's scouts reached for run extend, the lead's, to see their own stage.
  it('lets a scout see its stage from its research card — task check --tasks — never through run extend', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site'))))
      .checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    const loaded = await loadRun(lead(), runId);
    const { owner } = await viewTask(loaded.paths, findTask(loaded, SCOPE_SPIKE));
    const scout = bench.agent('scout-1', { token: owner?.token });
    const stage = await bench.writePlan({
      ...benchPlan(),
      runId: 'more',
      tasks: [{ ...benchPlan().tasks[0], id: 't-more', files: ['src/space/pages/extra.ts'], dependsOn: [] }]
    });

    expect(await seeProposal(scout, runId, SCOPE_SPIKE, stage)).toMatchObject({ added: ['t-more'], tried: [] });
    const extending = await refusal(extendRun(scout, runId, stage, { dryRun: true }));
    expect([extending.code, extending.message]).toEqual(['lead-only', expect.stringContaining('task check --tasks')]);
    expect((await refusal(extendRun(scout, runId, stage))).code).toBe('lead-only');
    // Another's card is no stage of its to see.
    expect((await refusal(seeProposal(bench.agent('dev-1'), runId, SCOPE_SPIKE, stage))).code).not.toBe(undefined);
  });

  it('keeps the primer a proposed stage names, so the lead’s approval stacks it whole', async () => {
    await bench.writeTeam(team(SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site'))))
      .checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    const plan = {
      ...benchPlan(),
      runId: 'es-scope',
      goal: 'The scope',
      tasks: benchPlan().tasks.slice(0, 1),
      primer: 'primer.md'
    };
    const file = await bench.writePlan(provenPlan(plan));
    await writeInCopy(path.dirname(file), 'primer.md', 'Dates are UTC.\n');
    await found(runId, SCOPE_SPIKE, 'Home first', { tasks: file });
    // Where the scout wrote it is gone by the time the lead approves: the stage reads the copy kept beside it.
    await fs.rm(path.join(path.dirname(file), 'primer.md'));

    expect((await approveFound(runId, SCOPE_SPIKE)).found?.added).toEqual(['t-home']);
    expect(await fs.readFile((await loadRun(lead(), runId)).paths.primer, 'utf-8')).toContain('Dates are UTC.');
  });
});

describe('the keeper, for scouts and testers', () => {
  const runOf = (loaded: Awaited<ReturnType<typeof loadRun>>) => ({
    identified: [],
    scratch: loaded.paths.scratch,
    openFor: 0,
    open: true,
    launches: true,
    now: bench.now().getTime()
  });
  const askedFor = async (runId: string, running: string[]): Promise<{ agent?: string; text: string }[]> => {
    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const started = startedAgents((await readTeam(bench.root)) ?? team());

    return agentsNeeded(views, started, new Set(running), runOf(loaded));
  };

  it('starts a scout for research of the plan — never for an agent’s question — and the scout a card was sent back to', async () => {
    await bench.writeTeam(team({ ...SCOUT, min: 0 }));
    const plan: RunPlan = benchPlan();
    const research = {
      ...plan.tasks[0],
      id: 's-words',
      title: 'The words',
      files: [],
      spike: 'which word for a booking'
    };
    plan.tasks = [...plan.tasks, research];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await blockTask(menu.ctx, runId, 't-menu', 'which colour for the prices', 'lead');
    const asked = (await askedFor(runId, ['agent-1'])).find(each => each.agent === 'scout-1')?.text ?? '';
    expect(asked).toContain('s-words');
    expect(asked).not.toContain('t-menu');

    await takeNext(bench.agent('scout-1'), runId, 'scout');
    await found(runId, 's-words', 'Reservar');
    await sendBack(runId, 's-words', 'Say where the original says it');
    // scout-1 stopped meanwhile: the card waits for it, by name.
    expect((await askedFor(runId, ['agent-1'])).find(each => each.agent === 'scout-1')?.text).toContain(
      's-words was sent back to scout-1, which is not running'
    );
  });

  it('counts a scout whose result waits for the lead free, and starts a tester for a designer’s step queued past its time', async () => {
    const plan = designed(benchPlan());
    plan.tasks = plan.tasks.map(task => (task.id === 't-home' ? { ...task, role: 'designer' } : task));
    plan.tasks.push(
      { ...plan.tasks[0], id: 's-a', title: 'A', files: [], role: undefined, spike: 'a', dependsOn: [] },
      { ...plan.tasks[0], id: 's-b', title: 'B', files: [], role: undefined, spike: 'b', dependsOn: [] }
    );
    await bench.writeTeam({
      version: 1,
      agents: [
        scripted({ name: 'agent', roles: ['developer'] }),
        scripted({ name: 'design', roles: ['designer'] }),
        scripted({ ...TESTERS, count: 1, min: 0 }),
        scripted({ ...SCOUT, count: 2, min: 0 })
      ]
    });
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    await found(runId, 's-a', 'Found A');
    // s-b waits, and scout-1 — its own handed to the lead — is free for it: no second scout.
    expect((await askedFor(runId, ['scout-1'])).map(each => each.agent)).not.toContain('scout-2');

    await take('design-1', 't-home');
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(menu.ctx, runId, 't-menu');
    bench.advance(REVIEW_QUEUE_MS);
    expect(
      (await askedFor(runId, ['design-1', 'agent-1', 'scout-1'])).find(each => each.agent === 'test-1')?.text
    ).toContain("the designer's review of t-menu");
  });
});

describe('a scout between spikes', () => {
  it('is started again fresh once what it found is with the lead — and keeps its context for one sent back', async () => {
    // Its session as a scout's is by default — after each piece — not the scripted agents' one session.
    const members = team();
    await bench.writeTeam({ ...members, agents: [...members.agents, { ...SCOUT, session: 'task' }] });
    const { runId } = (await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site'))))
      .checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    await found(runId, SCOPE_SPIKE, 'Two pages');
    expect(await nextTask(bench.agent('scout-1'), runId, 'scout')).toMatchObject({
      finished: true,
      why: expect.stringContaining('what you found on s-scope is with the lead') as unknown
    });

    await sendBack(runId, SCOPE_SPIKE, 'Name the pages');
    expect((await nextTask(bench.agent('scout-1'), runId, 'scout')).task?.id).toBe(SCOPE_SPIKE);
  });

  // The CLI's sanity run: sent back before its scout asked again, it was told "what you found is with the lead — stop".
  it('hands research sent back to its scout in the same context, as any card sent back', async () => {
    const members = team();
    await bench.writeTeam({ ...members, agents: [...members.agents, { ...SCOUT, session: 'task' }] });
    const { runId } = (await openRun(lead(), await bench.writePlan(scopePlan('es-launch', 'Translate the site'))))
      .checked;
    await takeNext(bench.agent('scout-1'), runId, 'scout');
    await found(runId, SCOPE_SPIKE, 'Two pages');
    // Sent back after its copy was last written, as a lead's review comes minutes later.
    bench.advance(60 * 60_000);
    await sendBack(runId, SCOPE_SPIKE, 'Name the pages');

    const back = await nextTask(bench.agent('scout-1'), runId, 'scout');
    expect(back.finished).toBeUndefined();
    expect(back).toMatchObject({ task: { id: SCOPE_SPIKE }, yours: 'changes-requested' });
  });
});

describe('what the lead is told, as manager', () => {
  it('leaves the spikes to the scouts and the queued designer’s steps to the testers', async () => {
    const plan = designed(benchPlan());
    plan.tasks.push({ ...plan.tasks[0], id: 's-a', title: 'A', files: [], spike: 'a', dependsOn: [] });
    await bench.writeTeam(team(TESTERS, SCOUT));
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const menu = await take('agent-1', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const page = {};\n');
    await completeTask(menu.ctx, runId, 't-menu');
    bench.advance(10 * 60_000);

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const started = startedAgents((await readTeam(bench.root)) ?? team());
    const kinds = bottlenecks(views, started, bench.now()).map(each => each.kind);
    expect(kinds).not.toContain('spikes');
    expect(kinds).not.toContain('review-waits');
    // Queued past its time, the designer's step is the tester's to take with the task.
    expect((await nextTask(bench.agent('test-1'), runId, 'tester')).review?.task.id).toBe('t-menu');
  });

  // A run's one tester reviewed card after card, read as free, and a review waited 33 minutes with nothing said.
  it('says a review queued behind a tester at another review — and that one more is the person’s to allow', async () => {
    await bench.writeTeam(team({ name: 'test', roles: ['tester'], count: 1 }));
    const { runId } = (await openRun(lead(), await bench.writePlan(benchPlan()))).checked;
    for (const [agent, id, file] of [
      ['agent-1', 't-menu', 'src/space/pages/menu.ts'],
      ['agent-2', 't-home', 'src/space/pages/home/index.ts']
    ] as const) {
      const taken = await take(agent, id);
      await writeInCopy(taken.work, file, 'export const page = {};\n');
      await completeTask(taken.ctx, runId, id);
    }
    await takeNext(bench.agent('test-1'), runId, 'tester');
    bench.advance(10 * 60_000);

    const loaded = await loadRun(lead(), runId);
    const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
    const started = startedAgents((await readTeam(bench.root)) ?? team());
    const waits = bottlenecks(views, started, bench.now()).find(each => each.kind === 'review-waits');
    expect(waits?.text).toMatch(/every reviewer of it busy \(test-1 at t-(menu|home)\)/);
    expect(waits?.text).toContain("one more is the person's to allow");
  });

  // The CLI's sanity run: its on-demand scout read "on demand" and nothing of the research card waiting for it.
  it('names in run plan each agent’s work — its cards, the steps it reviews, a scout’s research — on demand too', async () => {
    const members = team(TESTERS, { ...SCOUT, min: 0 });
    await bench.writeTeam(members);
    const plan = designed(benchPlan(), ['t-menu']);
    plan.tasks.push({
      ...plan.tasks[0],
      id: 's-words',
      title: 'The words',
      files: [],
      spike: 'which words',
      dependsOn: []
    });
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const lines = startLines((await loadRun(lead(), runId)).tasks, members).join('\n');
    expect(lines).toMatch(/test-1 — tester[^\n]*reviews t-home, t-menu, t-book, t-about/);
    expect(lines).toMatch(/scout-1 — scout — on demand \(s-words\)/);
    expect(lines).not.toContain('the UI of');

    const none = startLines(
      (await loadRun(lead(), runId)).tasks.filter(task => task.id !== 's-words'),
      members
    );
    expect(none.join('\n')).toContain('the research a stage brings');
  });
});
