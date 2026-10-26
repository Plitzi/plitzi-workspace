import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { leadItems } from './leadWatch';
import { monitorRun } from './monitor';
import { buildReport, reportText, writeSummary } from './report';
import { loadRun, openRun } from './run';
import { scopePlan } from './spike';
import { answerSpike, approveSpike, completeTask, escalateReview, nextTask, reviewTask, takeNext } from './tasks';
import { viewRun } from './view';
import { flowStages } from '../commands/runs/monitorFlow';
import { scripted } from '../tests/reviewerSteps';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { LEAD_SAID, runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * A whole run, played before any is run for real: the scope a scout finds out, the lead's approval, two developers, a
 * designer's look, a tester's QA with a send-back and an escalation, the close and the report — held at every step to
 * what must always be so. encore-10 met, one by one in a real run, a spike shown nowhere, a review said slow at four
 * minutes, a task of tests "held up", a lead never woken to close: each of them a step of this.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);
const RUN = 'es-launch';

/** The team a run starts with: two developers, a tester, a designer, a scout — each a scripted agent. */
const TEAM = {
  version: 1 as const,
  agents: [
    scripted({ name: 'dev', roles: ['developer'], count: 2 }),
    scripted({ name: 'test', roles: ['tester'] }),
    scripted({ name: 'design', roles: ['designer'] }),
    scripted({ name: 'scout', roles: ['scout'] })
  ]
};

/**
 * What must hold at every step of a run, whatever it is at: each task in one stage of the board, and every wake of the
 * lead about a task that is still where the wake says.
 */
const holds = async (step: string): Promise<void> => {
  const { view, agents } = await monitorRun(lead(), RUN);
  // An agent at a task is never shown idle: encore-10's board drew a task at work under one coloured as waiting.
  const atWork = view.tasks.filter(task => task.status === 'in-progress' && task.agent !== undefined);
  expect(
    atWork.flatMap(task =>
      agents.filter(each => each.agent === task.agent && each.status === 'idle').map(each => each.agent)
    ),
    `${step}: an agent at a task is not idle`
  ).toEqual([]);
  const placed = flowStages(view.tasks).flatMap(stage => stage.tasks.map(task => task.id));
  expect(placed.toSorted(), `${step}: each task in one stage of the board`).toEqual(
    view.tasks.map(task => task.id).toSorted()
  );

  const run = await viewRun(lead(), RUN);
  const done = new Set(run.tasks.filter(task => task.status === 'done').map(task => task.id));
  const stale = run.attention.filter(item => item.task !== undefined && done.has(item.task));
  expect(stale, `${step}: no wake about an approved task`).toEqual([]);
  const keys = leadItems(run).map(item => item.key);
  expect(keys.length, `${step}: each wake of the lead once`).toBe(new Set(keys).size);
  expect(
    run.attention.map(item => item.kind),
    `${step}: never "slow-review" nor "held-up" for what is on its way`
  ).not.toContain('held-up');
};

describe('a run, rehearsed whole', () => {
  it('goes from the scope to the report with every step as it should be', async () => {
    await bench.writeTeam(TEAM);
    await openRun(lead(), await bench.writePlan({ ...scopePlan(RUN, 'A Spanish version'), designReview: true }));
    await holds('opened on its scope');

    // The scout finds the scope out and proposes the tasks; the lead approves them.
    const scouting = await takeNext(bench.agent('scout-1'), RUN, 'scout');
    expect(scouting.next.spike?.task.id).toBe('s-scope');
    await holds('the scope at work');
    const [menu, home] = benchPlan().tasks.filter(task => task.id === 't-menu' || task.id === 't-home');
    // In its scratch, as a scout writes beside its work: the project's tmp/ is the person's.
    const stage = path.join(scouting.next.scratch, 'stage.json');
    await fs.writeFile(
      stage,
      JSON.stringify({
        tasks: [
          { ...menu, dependsOn: [] },
          { ...home, dependsOn: [] }
        ]
      })
    );
    await answerSpike(bench.agent('scout-1'), RUN, 's-scope', 'Two pages: the menu and the home', { tasks: stage });
    await holds('the scope proposed');
    expect((await nextTask(lead(), RUN, 'lead')).proposal?.task.id).toBe('s-scope');
    await approveSpike(lead(), RUN, 's-scope');
    await holds('the scope approved');

    // Two developers at once.
    const first = await takeNext(bench.agent('dev-1'), RUN, 'developer');
    const second = await takeNext(bench.agent('dev-2'), RUN, 'developer');
    expect([first.next.task?.id, second.next.task?.id].toSorted()).toEqual(['t-home', 't-menu']);
    await holds('both at work');

    const agentOf = (taken: typeof first): string => (taken === first ? 'dev-1' : 'dev-2');
    const copyOf = (taken: typeof first) => {
      if (!taken.taken || !taken.next.task) {
        throw new Error('nothing was taken');
      }

      return {
        id: taken.next.task.id,
        work: taken.taken.work,
        ctx: bench.agent(agentOf(taken), { token: taken.taken.token })
      };
    };
    const one = copyOf(first);
    const two = copyOf(second);
    const fileOf = (id: string): string =>
      id === 't-menu' ? 'src/space/pages/menu.ts' : 'src/space/pages/home/index.ts';
    await writeInCopy(one.work, fileOf(one.id), 'export const page = { title: "Carta" };\n');
    await completeTask(one.ctx, RUN, one.id);
    await holds('one in review');

    // The designer's look, then the tester's QA, which sends it back.
    const look = await takeNext(bench.agent('design-1'), RUN, 'designer');
    expect(look.next.designReview?.task.id).toBe(one.id);
    await reviewTask(bench.agent('design-1'), RUN, one.id, 'approve', []);
    const qa = await takeNext(bench.agent('test-1'), RUN, 'tester');
    expect(qa.next.leadReview?.task.id).toBe(one.id);
    await reviewTask(bench.agent('test-1'), RUN, one.id, 'changes', [{ note: 'Say "Carta del día"' }]);
    await holds('one sent back');

    // Its developer takes it back first, and sends it again.
    const back = await nextTask(one.ctx, RUN, 'developer');
    expect(back.task?.id).toBe(one.id);
    await writeInCopy(one.work, fileOf(one.id), 'export const page = { title: "Carta del día" };\n');
    await completeTask(one.ctx, RUN, one.id);
    await takeNext(bench.agent('design-1'), RUN, 'designer');
    await reviewTask(bench.agent('design-1'), RUN, one.id, 'approve', []);
    await takeNext(bench.agent('test-1'), RUN, 'tester');
    await reviewTask(bench.agent('test-1'), RUN, one.id, 'approve', []);
    await holds('one approved');

    // The other, escalated by the tester, approved by the lead.
    await writeInCopy(two.work, fileOf(two.id), 'export const page = { title: "Inicio" };\n');
    await completeTask(two.ctx, RUN, two.id);
    await takeNext(bench.agent('design-1'), RUN, 'designer');
    await reviewTask(bench.agent('design-1'), RUN, two.id, 'approve', []);
    await takeNext(bench.agent('test-1'), RUN, 'tester');
    await escalateReview(bench.agent('test-1'), RUN, two.id, 'Whether "Inicio" or "Portada" is the lead’s');
    await holds('the other escalated');
    await reviewTask(lead(), RUN, two.id, 'approve', []);
    await holds('every task approved');

    // Every task approved, the lead is woken to close — and closes.
    expect(leadItems(await viewRun(lead(), RUN)).map(item => item.key)).toContainEqual(
      expect.stringContaining('all-approved')
    );
    await bench.write('summary.md', '# What the run did\n\nThe menu and the home, in Spanish.\n');
    await writeSummary(lead(), RUN, 'summary.md', LEAD_SAID);

    // The report starts with what a person decides on, and finds nothing wrong in a run worked as it should be.
    const report = await buildReport(lead(), await loadRun(lead(), RUN));
    const text = reportText(report, '# Summary');
    expect(text).toContain('## Before you apply');
    expect(report.findings.filter(finding => finding.owner === 'lead').map(finding => finding.kind)).toEqual([]);
    // A whole run in one test: 1.5 s alone, past vitest's 5 s beside the whole suite once.
  }, 30_000);
});
