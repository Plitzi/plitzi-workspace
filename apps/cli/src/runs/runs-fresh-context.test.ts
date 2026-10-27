import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { monitorRun } from './monitor';
import { STARTING_MS } from './onDemand';
import { takeStep } from './reviews';
import { loadRun, logRun, openRun } from './run';
import { blockTask, completeTask, nextTask, reviewTask, takeTask, unblockTask } from './tasks';
import { viewTask } from './taskStore';
import { setTeamAgent } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

/**
 * Its developers, a session a task, read ~12k tokens' worth a turn; its designer and tester, never started
 * again, grew to 400k and read 26–30k a turn. An agent is started again with a fresh context between two pieces of
 * work — once its context passes the team's `freshContextAt`, or after each one (`"session": "task"`).
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

/** An agent whose harness holds `tokens` of context. */
const holding = (agent: string, tokens: number, token?: string): RunContext =>
  bench.agent(agent, { context: () => Promise.resolve(tokens), ...(token ? { token } : {}) });

const plan = () => {
  const each = benchPlan();
  each.tasks = each.tasks
    .filter(task => task.id === 't-home' || task.id === 't-menu')
    .map(task => ({ ...task, dependsOn: [] }));

  return each;
};

const completeHome = async (agent: string, tokens: number): Promise<void> => {
  const home = await takeTask(holding(agent, tokens), 'es-launch', 't-home');
  await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const page = {};\n');
  await completeTask(holding(agent, tokens, home.token), 'es-launch', 't-home');
};

describe('a fresh context', () => {
  it('starts an agent again once its context passes the team’s, between two tasks — never under it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], session: 'context' });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 80_000);
    expect(await nextTask(holding('dev-1', 80_000), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-menu' }) as unknown
    });

    const menu = await takeTask(holding('dev-1', 300_000), 'es-launch', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await completeTask(holding('dev-1', 300_000, menu.token), 'es-launch', 't-menu');
    expect(await nextTask(holding('dev-1', 300_000), 'es-launch', 'developer')).toMatchObject({
      finished: true,
      why: expect.stringContaining(
        't-menu is complete, and your context is 300k tokens, past the team’s 250k'.replace('’', "'")
      ) as unknown
    });
    // Started again: its new session has ended nothing yet.
    expect(await nextTask(holding('dev-1', 46_000), 'es-launch', 'developer')).not.toMatchObject({ finished: true });
  });

  it('keeps the context of the task it just completed when it is sent back already', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 300_000);
    await reviewTask(lead(), 'es-launch', 't-home', 'changes', [{ note: 'The title again' }]);
    expect(await nextTask(holding('dev-1', 300_000), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-home' }) as unknown,
      yours: 'changes-requested'
    });
  });

  it('starts a tester again past it once its review is decided, and one that keeps its session never', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], session: 'keep' });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'], session: 'context' });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 300_000);
    expect(await nextTask(holding('dev-1', 300_000), 'es-launch', 'developer')).not.toMatchObject({
      finished: true
    });

    expect((await nextTask(holding('test-1', 300_000), 'es-launch', 'tester')).review?.task.id).toBe('t-home');
    await reviewTask(holding('test-1', 300_000), 'es-launch', 't-home', 'approve', []);
    expect(await nextTask(holding('test-1', 300_000), 'es-launch', 'tester')).toMatchObject({
      finished: true,
      why: expect.stringContaining('your review of t-home is decided, and your context is 300k tokens') as unknown
    });
  });

  // Carlos: never in a task, however far past it its context is — what it knows of the task and has not written is lost.
  it('never stops an agent in a task: one it took since, or one blocked and given back to it', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 300_000);
    const menu = await takeTask(holding('dev-1', 305_000), 'es-launch', 't-menu');
    // Its `task next` while it holds t-menu at work hands it t-menu, never a stop.
    expect(await nextTask(holding('dev-1', 310_000), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-menu' }) as unknown,
      yours: 'in-progress'
    });

    await blockTask(holding('dev-1', 320_000, menu.token), 'es-launch', 't-menu', 'Which title?', 'lead');
    expect(await nextTask(holding('dev-1', 190_000), 'es-launch', 'developer')).not.toMatchObject({ finished: true });
    await unblockTask(lead(), 'es-launch', 't-menu', 'Carta');
    expect(await nextTask(holding('dev-1', 330_000), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-menu' }) as unknown,
      yours: 'in-progress'
    });

    // Its piece ended: now it stops.
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await completeTask(holding('dev-1', 340_000, menu.token), 'es-launch', 't-menu');
    expect(await nextTask(holding('dev-1', 340_000), 'es-launch', 'developer')).toMatchObject({ finished: true });
  });

  it('never stops a reviewer with a review it took and has not decided', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 50_000);
    const menu = await takeTask(holding('dev-2', 50_000), 'es-launch', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');
    await completeTask(holding('dev-2', 50_000, menu.token), 'es-launch', 't-menu');

    expect((await nextTask(holding('test-1', 300_000), 'es-launch', 'tester')).review?.task.id).toBeDefined();
    await reviewTask(holding('test-1', 300_000), 'es-launch', 't-home', 'approve', []);
    // The next review taken — as its look takes it — and not decided yet: it goes on with it.
    const loaded = await loadRun(lead(), 'es-launch');
    const next = loaded.tasks.find(task => task.id === 't-menu');
    expect(next && (await takeStep(holding('test-1', 305_000), await viewTask(loaded.paths, next))).taken).toBe(true);
    expect(await nextTask(holding('test-1', 310_000), 'es-launch', 'tester')).not.toMatchObject({ finished: true });

    await reviewTask(holding('test-1', 320_000), 'es-launch', 't-menu', 'approve', []);
    expect(await nextTask(holding('test-1', 320_000), 'es-launch', 'tester')).toMatchObject({ finished: true });
  });

  it('starts an agent of "session": "task" again after each task, whatever its context', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], session: 'task' });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 50_000);
    expect(await nextTask(holding('dev-1', 50_000), 'es-launch', 'developer')).toMatchObject({
      finished: true,
      why: expect.stringContaining("after each task or review (your team's session: task)") as unknown
    });

    // The monitor read a base agent "stopped" while the run started it again — it is restarting, said so,
    // before its launch and after it, until its first command.
    const dev = async () => (await monitorRun(lead(), 'es-launch')).agents.find(agent => agent.agent === 'dev-1');
    expect(await dev()).toMatchObject({
      status: 'restarting',
      doing: expect.stringContaining('restarting') as unknown
    });
    const loaded = await loadRun(lead(), 'es-launch');
    await logRun(lead(), loaded.paths, { action: 'launch', agent: 'dev-1', harness: 'claude' });
    expect(await dev()).toMatchObject({
      status: 'restarting',
      doing: expect.stringContaining('started again') as unknown
    });
    // Its first command of the new session (here its join, as the bench's one session cannot be started anew).
    await logRun(holding('dev-1', 0), loaded.paths, { action: 'joined' });
    expect((await dev())?.status).not.toBe('restarting');
  });
});

describe('a task sent back to an agent at another', () => {
  // Carlos: a task sent back waits for the agent that has its context, which takes it once it ends the one it is at.
  it('waits for it, said so, and never reads "no signal — reassign it" meanwhile', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await openRun(lead(), await bench.writePlan(plan()));
    bench.advance(STARTING_MS);

    await completeHome('dev-1', 50_000);
    const menu = await takeTask(holding('dev-1', 60_000), 'es-launch', 't-menu');
    await reviewTask(lead(), 'es-launch', 't-home', 'changes', [{ note: 'The title again' }]);
    // dev-1 is at t-menu, writing: t-home waits for it, long past a task's silence.
    for (let minute = 0; minute < 120; minute += 10) {
      bench.advance(10 * 60_000);
      await writeInCopy(menu.work, 'src/space/pages/menu.ts', `export const menu = { at: ${String(minute)} };\n`);
      // Written now, by the run's clock: the bench's moves on, the files' would not.
      await fs.utimes(path.join(menu.work, 'src/space/pages/menu.ts'), bench.now(), bench.now());
    }

    const view = await viewRun(lead(), 'es-launch');
    expect(view.tasks.find(task => task.id === 't-home')).toMatchObject({ parkedFor: 't-menu', noSignal: false });
    expect(view.attention).not.toContainEqual(expect.objectContaining({ kind: 'no-signal', task: 't-home' }));
    // dev-2, free, is not handed it.
    expect((await nextTask(holding('dev-2', 50_000), 'es-launch', 'developer')).task?.id).not.toBe('t-home');

    // t-menu done: its session ends there (`task`, the default), and the next one — dev-1's still — takes t-home first.
    await completeTask(holding('dev-1', 70_000, menu.token), 'es-launch', 't-menu');
    expect(await nextTask(holding('dev-1', 70_000), 'es-launch', 'developer')).toMatchObject({
      finished: true,
      why: expect.stringContaining('for t-home, which you hold') as unknown
    });
    expect(await nextTask(holding('dev-1', 46_000), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-home' }) as unknown,
      yours: 'changes-requested'
    });
  });
});
