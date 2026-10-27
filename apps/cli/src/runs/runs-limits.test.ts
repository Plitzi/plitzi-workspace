import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runsSuite, SLOW_LINE_MS } from './acceptance';
import { leadItems } from './leadWatch';
import { checkPlanFile, openRun } from './run';
import { completeTask, reviewTask } from './tasks';
import { keepAlive, KEEP_ALIVE_MS } from './tasks/keepAlive';
import { viewRun } from './view';
import { reusedServerText, slowLineText } from '../commands/runs/text';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { TaskView } from './taskStore';
import type { Bench } from '../tests/runProject';

/**
 * The time a run's work takes, held to Carlos's rule: a piece past 10 minutes is likely wrong, a check takes minutes at
 * most, one Playwright suite runs at a time on the machine, and an agent inside a long check is still there.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  vi.useRealTimers();
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

describe('a plan held to the time its work takes', () => {
  it('says a piece estimated past its limit, and a line that runs a whole suite', async () => {
    await bench.write(
      'package.json',
      JSON.stringify({ name: 'bench', type: 'module', private: true, scripts: { visual: 'playwright test' } })
    );
    const plan = benchPlan();
    plan.tasks[0] = {
      ...plan.tasks[0],
      estimateMinutes: 25,
      acceptance: [{ said: 'The suite passes', check: 'npm run visual' }]
    };
    plan.tasks[1] = {
      ...plan.tasks[1],
      acceptance: [{ said: 'Its spec passes', check: 'npm run visual -- visual/menu.spec.ts' }]
    };
    const { notices } = await checkPlanFile(lead(), await bench.writePlan(plan));

    expect(notices).toContainEqual(expect.stringContaining(`Estimated past the 10 min`));
    expect(notices.find(notice => notice.startsWith('Estimated past'))).toContain(`${plan.tasks[0].id} 25 min`);
    const suite = notices.find(notice => notice.includes('runs a whole Playwright suite')) ?? '';
    expect(suite).toContain(plan.tasks[0].id);
    expect(suite).not.toContain(plan.tasks[1].id);
  });
});

describe('a check that runs a suite', () => {
  it('is told by its command or the project script it calls', () => {
    expect(runsSuite('npx playwright test visual/a.spec.ts', [])).toBe(true);
    expect(runsSuite('npm run visual -- visual/a.spec.ts', ['visual'])).toBe(true);
    expect(runsSuite('npm run visualize', ['visual'])).toBe(false);
    expect(runsSuite('node --test src', ['visual'])).toBe(false);
  });

  it('is said past the time a check takes', () => {
    expect(slowLineText({ ms: SLOW_LINE_MS + 60_000 })).toContain('took 3 min');
    expect(slowLineText({ ms: 30_000 })).toBe('');
  });

  // encore-10's dev-1 read a failure as a product bug: Playwright had reused the copy served, its webServer.env unset.
  it('says, when it failed, that its Playwright reused the copy served', () => {
    expect(reusedServerText({ reused: 8301 })).toContain('reused the copy served on :8301 (PORT)');
    expect(reusedServerText({})).toBe('');
  });
});

describe('a task inside a long check', () => {
  // encore-10's dev-1 read "no signal — reassign it" inside one whole suite pass its acceptance asked for.
  it('gives its sign of life while the check runs', async () => {
    vi.useFakeTimers();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-alive-'));
    const progress = path.join(dir, 'progress.json');
    const view = { paths: { progress } } as unknown as TaskView; // Only its progress file is what a beat writes.
    let release = (): void => undefined;
    const running = keepAlive(
      view,
      () => new Date(),
      () => new Promise<void>(resolve => (release = resolve))
    );
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS + 10);
    vi.useRealTimers();
    await new Promise(resolve => setTimeout(resolve, 20));
    const beat: unknown = JSON.parse(await fs.readFile(progress, 'utf-8'));
    expect(beat).toMatchObject({ heartbeatAt: expect.any(String) as unknown });
    release();
    await running;
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('a run whose every task is approved', () => {
  // encore-10's watch said "Nothing new for the lead … (10 of 10 done)" and the close waited for Carlos.
  it('wakes its lead to close it', async () => {
    const plan = benchPlan();
    plan.tasks = [plan.tasks[0]];
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const taken = await take('agent-1', plan.tasks[0].id);
    await writeInCopy(taken.work, plan.tasks[0].files[0], 'export const page = { title: "Inicio" };\n');
    await completeTask(taken.ctx, runId, plan.tasks[0].id);
    await reviewTask(lead(), runId, plan.tasks[0].id, 'approve', []);

    const items = leadItems(await viewRun(lead(), runId));
    expect(items.find(item => item.key.startsWith('all-approved'))?.text).toContain('close the run — plitzi run look');
  });
});
