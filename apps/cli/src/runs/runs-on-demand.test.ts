import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readLaunch, writeLaunch } from './launch';
import { waitForLead } from './leadWatch';
import { STARTING_MS } from './onDemand';
import { isRunRefusal } from './refusal';
import { loadRun, openRun, readRunLog } from './run';
import { completeTask, followNext, nextTask, reviewTask, takeTask } from './tasks';
import { readTeam, setTeamAgent, startedAgents } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';

import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

/** A team past its `min`: the agents that start with the run, and those on demand, started when work waits for them. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const lead = (): RunContext => bench.agent('lead');

const refusalOf = async (work: Promise<unknown>): Promise<string> => {
  const refused = await work.then(
    () => undefined,
    (error: unknown) => error
  );

  return isRunRefusal(refused) ? refused.message : 'not refused';
};

describe('agents on demand', () => {
  // A team spends the tokens of the agents its work asks for: past `min`, an agent starts when work waits for it, and
  // stops once none is left.
  it('tells the lead which to start when work waits and none running is free — and lets one with nothing stop', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2, min: 1 });
    const team = await readTeam(bench.root);
    expect(team ? startedAgents(team).map(each => [each.agent, each.onDemand ?? false]) : []).toEqual([
      ['dev-1', false],
      ['dev-2', true]
    ]);
    await openRun(lead(), await bench.writePlan(benchPlan()));

    // Nobody running: the one that starts with the run first — once it had time to join, never the moment it opens.
    expect((await viewRun(lead(), 'es-launch')).attention.map(item => item.kind)).not.toContain('agents-needed');
    bench.advance(STARTING_MS);
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining('none running is free: start dev-1 — plitzi run agent dev-1 --launch') as unknown
      })
    );

    // dev-1 at t-home; t-menu and t-about wait — shared with dev-2, a task and a half each: not worth its start, as
    // `run plan` counts it (velada-shell: the plan said the team was too big, the watch asked for dev-2).
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    expect((await viewRun(lead(), 'es-launch')).attention.map(item => item.kind)).not.toContain('agents-needed');

    // Started, and handed nothing it may take for a while — every ready task taken, t-book waiting — it stops, said.
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-about');
    const stopped = await followNext(bench.agent('dev-2'), 'es-launch', 'developer', {
      timeoutMs: 2000,
      everyMs: 10,
      onDemandIdleMs: 30
    });
    expect(stopped).toMatchObject({ finished: true, why: expect.stringContaining('you are on demand') as unknown });
  });

  // lx-product: t-buybox waited for t-description alone, in hand — four cards for one developer, and no dev-2 asked.
  it('counts as coming a task that waits only for work under way', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2, min: 1 });
    const plan = benchPlan();
    plan.tasks = plan.tasks.map(task => (task.id === 't-book' ? { ...task, dependsOn: ['t-home'] } : task));
    await openRun(lead(), await bench.writePlan(plan));
    bench.advance(STARTING_MS);
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');

    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining('start dev-2, on demand') as unknown
      })
    );
  });

  it('asks for one on demand once the work waiting, shared with it, is worth its start', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2, min: 1 });
    // Three rounds of the bench's tasks, each its own files: work enough for two.
    const big = {
      ...benchPlan(),
      tasks: [0, 1, 2].flatMap(round =>
        benchPlan().tasks.map(task => ({
          ...task,
          id: `${task.id}-${String(round)}`,
          files: task.files.map(file => file.replace('src/space/pages/', `src/space/pages/round-${String(round)}/`)),
          dependsOn: task.dependsOn.map(id => `${id}-${String(round)}`)
        }))
      )
    };
    await openRun(lead(), await bench.writePlan(big));
    bench.advance(STARTING_MS);
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-home-0');

    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining('none running is free: start dev-2, on demand') as unknown
      })
    );
  });

  // velada-dress: design-1 wrote t-shell, and was counted free for its UI review — design-2, on demand, never asked for.
  it('asks for another designer for a UI review its author cannot make', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'developer'], count: 2, min: 1 });
    const plan = benchPlan();
    plan.tasks[3].role = 'designer';
    await openRun(lead(), await bench.writePlan(plan));
    // Its designer asks for its UI to be looked at: by another designer.
    const about = await takeTask(bench.agent('design-1'), 'es-launch', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const page = { title: `t-about` };\n');
    await completeTask(bench.agent('design-1', { token: about.token }), 'es-launch', 't-about', { review: 'ui' });

    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining(
          'the UI of t-about waits for a designer, and none running is free: start design-2'
        ) as unknown
      })
    );
  });

  // encore: both designers ended on a 'waiting' — the log read them running for good — and the UI reviews that waited
  // were asked of nobody; their processes, launched by the CLI, had ended.
  it('asks for a designer whose launched process has ended, whatever its last word in the log', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);
    // design-1 was there and waited for work: its last word, a wait.
    await followNext(bench.agent('design-1'), 'es-launch', 'designer', { timeoutMs: 0, everyMs: 10 });
    const { paths } = await loadRun(lead(), 'es-launch');
    await writeLaunch(paths, 'design-1', {
      pid: 999_999_999,
      harness: 'claude',
      startedAt: new Date(0).toISOString(),
      log: path.join(paths.scratch, 'design-1', 'agent.log')
    });
    const home = await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: `Hola` };\n');
    await completeTask(bench.agent('dev-1', { token: home.token }), 'es-launch', 't-home', { review: 'ui' });

    const view = await viewRun(lead(), 'es-launch');
    expect(view.gone).toEqual(['design-1']);
    expect(view.attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining(
          'the UI of t-home waits for a designer, and none running is free: start design-1'
        ) as unknown
      })
    );
  });

  // encore: tasks waited 24 to 56 min to be taken while the lead, planning or reviewing, was the only one to start
  // agents. With options.launch the lead's own wait starts them.
  it.skipIf(process.platform === 'win32')(
    'starts the agent the run asks for by itself, with options.launch, and does not wake the lead for it',
    async () => {
      await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
      await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
      const teamFile = path.join(bench.root, '.plitzi', 'team.json');
      const team = JSON.parse(await fs.readFile(teamFile, 'utf-8')) as Record<string, unknown>;
      await fs.writeFile(teamFile, JSON.stringify({ ...team, options: { launch: 'claude' } }));
      // A harness of its own on the PATH: it waits, as an agent at work would, and is stopped after.
      const bin = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-harness-'));
      await fs.writeFile(path.join(bin, 'claude'), '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
      const before = process.env.PATH;
      process.env.PATH = `${bin}${path.delimiter}${before ?? ''}`;
      try {
        await openRun(lead(), await bench.writePlan(benchPlan()));
        bench.advance(STARTING_MS);
        const home = await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
        await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: `Hola` };\n');
        await completeTask(bench.agent('dev-1', { token: home.token }), 'es-launch', 't-home', { review: 'ui' });

        const news = await waitForLead(lead(), 'es-launch', { timeoutMs: 200, everyMs: 50 });
        const { paths } = await loadRun(lead(), 'es-launch');
        const launch = await readLaunch(paths, 'design-1');

        expect(launch).toMatchObject({ harness: 'claude' });
        expect(news.fresh.some(item => item.text.includes('start design-1'))).toBe(false);
        expect((await readRunLog(paths)).some(entry => entry.action === 'launch' && entry.agent === 'design-1')).toBe(
          true
        );
        if (launch) {
          process.kill(launch.pid);
        }
      } finally {
        process.env.PATH = before;
        await fs.rm(bin, { recursive: true, force: true });
      }
    }
  );

  // Carlos: the base agent first, and one on demand only when it is needed — the base being free, it takes the work.
  it('hands ready work to a free base agent first: one on demand takes only what the base cannot', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2, min: 1 });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    // dev-1 is there, between tasks — its follow marks it present — and dev-2, on demand, asks.
    await followNext(bench.agent('dev-1'), 'es-launch', 'developer', { timeoutMs: 0, everyMs: 10 });
    await followNext(bench.agent('dev-2'), 'es-launch', 'developer', { timeoutMs: 0, everyMs: 10 });
    const ready = (await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).ready;

    // Three ready, dev-1 free: dev-2 is handed the second, the first is dev-1's.
    expect((await nextTask(bench.agent('dev-2'), 'es-launch', 'developer')).task?.id).toBe(ready[1]);
    // One ready, dev-1 free: nothing for dev-2, said.
    await takeTask(bench.agent('dev-3'), 'es-launch', ready[1]);
    await takeTask(bench.agent('dev-3'), 'es-launch', ready[2]);
    expect(await nextTask(bench.agent('dev-2'), 'es-launch', 'developer')).toMatchObject({
      why: expect.stringContaining(`${ready[0]} ready, for dev-1, free and of the team's base`) as unknown
    });
    // dev-1 gone — no mark for a while — and the work is dev-2's.
    bench.advance(3 * 60_000);
    expect((await nextTask(bench.agent('dev-2'), 'es-launch', 'developer')).task?.id).toBe(ready[0]);
  });

  // velada-dress: design-2, on demand, stopped at 20:18 with four UI reviews on their way, and was started again for them.
  it('keeps a designer on demand while more UI reviews are coming than the other designers running', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'], count: 2, min: 1 });
    await openRun(lead(), await bench.writePlan({ ...benchPlan(), designReview: true }));
    await followNext(bench.agent('design-1'), 'es-launch', 'designer', { timeoutMs: 0, everyMs: 10 });
    await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    await takeTask(bench.agent('dev-2'), 'es-launch', 't-menu');

    const kept = await followNext(bench.agent('design-2'), 'es-launch', 'designer', {
      timeoutMs: 200,
      everyMs: 10,
      onDemandIdleMs: 30
    });
    expect(kept.finished).not.toBe(true);
  });

  // lx-product: dev-1 read 30.9M tokens for three tasks, each turn reading again what the tasks before it left; a session
  // a task reads ~40 % less. The CLI cannot empty a harness's context: it tells the agent to stop, and the lead starts it.
  it('ends a session of one task once it is complete, and asks for the next — for its own sent back too', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], sessionPerTask: true });
    const team = await readTeam(bench.root);
    expect(team ? startedAgents(team) : []).toEqual([{ agent: 'dev-1', roles: ['developer'], sessionPerTask: true }]);
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);

    const taken = await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    const complete = async (round: number) => {
      await writeInCopy(
        taken.work,
        'src/space/pages/home/index.ts',
        `export const page = { round: ${String(round)} };\n`
      );
      await completeTask(bench.agent('dev-1', { token: taken.token }), 'es-launch', 't-home');
    };
    await complete(1);
    expect(await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).toMatchObject({
      finished: true,
      why: expect.stringContaining('t-home is complete: your team gives you one task a session') as unknown
    });
    // Stopped, with work waiting: started again, though it starts with the run.
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({ kind: 'agents-needed', text: expect.stringContaining('start dev-1') as unknown })
    );

    await reviewTask(lead(), 'es-launch', 't-home', 'changes', [{ note: 'The title again' }]);
    expect((await viewRun(lead(), 'es-launch')).attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining('t-home was sent back to dev-1, which is not running: start it again') as unknown
      })
    );
    // Waiting for its agent to be started is no silence: "reassign it" beside "start it again" said two things.
    bench.advance(2 * 60 * 60_000);
    const waiting = await viewRun(lead(), 'es-launch');
    expect(waiting.attention).toContainEqual(
      expect.objectContaining({
        kind: 'agents-needed',
        text: expect.stringContaining('t-home was sent back') as unknown
      })
    );
    expect(waiting.attention).not.toContainEqual(expect.objectContaining({ kind: 'no-signal' }));
    expect(waiting.tasks.find(task => task.id === 't-home')?.noSignal).toBe(false);
    // Its next session: its own first, then stopped again once it is complete.
    expect(await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-home' }) as unknown,
      yours: 'changes-requested'
    });
    await complete(2);
    expect(await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).toMatchObject({ finished: true });
  });

  // encore's dev-1: after t-player, next handed it t-shell, held from an earlier session — two tasks in one context.
  it('leaves a task held from an earlier session to the next one, saying so', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], sessionPerTask: true });
    await openRun(lead(), await bench.writePlan(benchPlan()));
    bench.advance(STARTING_MS);

    await takeTask(bench.agent('dev-1'), 'es-launch', 't-home');
    const menu = await takeTask(bench.agent('dev-1'), 'es-launch', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(bench.agent('dev-1', { token: menu.token }), 'es-launch', 't-menu');

    expect(await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).toMatchObject({
      finished: true,
      why: expect.stringContaining('for t-home, which you still hold') as unknown
    });
    expect(await nextTask(bench.agent('dev-1'), 'es-launch', 'developer')).toMatchObject({
      task: expect.objectContaining({ id: 't-home' }) as unknown
    });
  });

  it('refuses a min past its count', async () => {
    expect(await refusalOf(setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2, min: 3 }))).toContain(
      'its min — how many start with the run — is a whole number from 1 to its count (2)'
    );
  });
});
