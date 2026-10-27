import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keepLook, keptLook, LOOKED_FOR_MS, lookKey, pagesLooked } from './lookParts';
import { lookedAmong } from '../../runs/pagesOf';
import { runPaths, taskPaths } from '../../runs/paths';
import { openRun } from '../../runs/run';
import { completeTask, takeTask } from '../../runs/tasks';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

// The sanity run: a lead looked after the designer, nothing changed between — 8 s for the same answer.
describe('a look kept for the same look asked again', () => {
  it('stands while the task, the run and the ask are as they were — and is a new look past its time', async () => {
    const plan = benchPlan();
    await openRun(bench.agent('lead'), await bench.writePlan(plan));
    const taken = await takeTask(bench.agent('dev-1'), plan.runId, 't-home');
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola' };\n");
    await completeTask(bench.agent('dev-1', { token: taken.token }), plan.runId, 't-home');
    const lead = bench.agent('lead');
    const { cache } = taskPaths(runPaths(bench.root, plan.runId), 't-home');

    const key = await lookKey(lead, plan.runId, 't-home', { paths: [] });
    expect(await lookKey(lead, plan.runId, 't-home', { paths: [] })).toBe(key);
    expect(await lookKey(lead, plan.runId, 't-home', { paths: ['/menu'] })).not.toBe(key);

    await keepLook(cache, key, 'the look', bench.now());
    expect(await keptLook(cache, key, bench.now())).toMatchObject({ text: 'the look' });
    expect(await keptLook(cache, 'another', bench.now())).toBeUndefined();
    // A second look, of other pages, keeps the first (each look forgot the pages the other covered).
    await keepLook(cache, 'other pages', 'the other look', bench.now());
    expect(await keptLook(cache, key, bench.now())).toMatchObject({ text: 'the look' });
    expect(await keptLook(cache, 'other pages', bench.now())).toMatchObject({ text: 'the other look' });

    // Its copy changed after it went to review: a new look.
    await writeInCopy(taken.work, 'src/space/pages/home/index.ts', "export const home = { title: 'Hola!' };\n");
    expect(await lookKey(lead, plan.runId, 't-home', { paths: [] })).not.toBe(key);

    bench.advance(LOOKED_FOR_MS + 1);
    expect(await keptLook(cache, key, bench.now())).toBeUndefined();
  });
});

// A look of /u/mika warned /u/:username was not looked at, and forgot the round's earlier look of / and /rooms.
describe('the pages a task was looked at on', () => {
  it('count an address for the route it fits', () => {
    expect(lookedAmong('/u/:username', ['/u/mika'])).toBe(true);
    expect(lookedAmong('/u/:username/:which', ['/u/mika'])).toBe(false);
    expect(lookedAmong('/rooms', ['/rooms?tab=live'])).toBe(true);
    expect(lookedAmong('/rooms', ['/rooms/new'])).toBe(false);
    expect(lookedAmong('/r/:slug', ['/r/night-drive?x=1'])).toBe(true);
  });

  it('are every look’s of the task as it is now, and none of another state’s', async () => {
    const cache = bench.root;
    await keepLook(cache, 'one', 'a look', bench.now(), { state: 'now', pages: ['/', '/rooms'] });
    await keepLook(cache, 'two', 'b look', bench.now(), { state: 'now', pages: ['/u/mika'] });
    await keepLook(cache, 'old', 'c look', bench.now(), { state: 'before', pages: ['/settings'] });

    expect((await pagesLooked(cache, 'now', bench.now())).sort()).toEqual(['/', '/rooms', '/u/mika']);
  });
});
