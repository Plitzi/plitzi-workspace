import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extendRun } from './extend';
import { makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { loadRun } from '../run';
import { readInbox } from '../talk/talk';

import type { Bench } from '../../tests/runProject';
import type { RunPlan } from '../core/model';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take } = runSteps(() => bench);

describe('a stage stacked on a task at work', () => {
  // A run's header fix waited on t-window-page, which held its page's 26 files for the one it named: a stage's task gets
  // a file a task at work holds only as part of its page and has not changed — never one it named or wrote in.
  it('gives a stage task a file a task at work holds only as part of its page, unchanged — said to both', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const hero = {
      id: 't-hero',
      title: 'The hero, wider',
      files: ['src/space/pages/home/hero.ts'],
      dependsOn: [],
      priority: 'medium' as const,
      estimateMinutes: 10,
      acceptance: ['The hero is wider']
    };
    const stage = (id: string): RunPlan => ({ version: 1, runId: id, goal: 'Hero', tasks: [{ ...hero, id }] });

    const stacked = await extendRun(lead(), 'es-launch', await bench.writePlan(stage('t-hero')));
    expect(stacked.released).toEqual([{ file: 'src/space/pages/home/hero.ts', from: 't-home', to: 't-hero' }]);
    expect(stacked.notices).toContain(
      'src/space/pages/home/hero.ts goes to "t-hero": "t-home" held it only as part of its page, unchanged in its copy — it is told, and keeps its own'
    );
    const loaded = await loadRun(lead(), 'es-launch');
    expect(loaded.tasks.find(task => task.id === 't-home')?.files).toEqual(['src/space/pages/home/index.ts']);
    expect((await readInbox(home.ctx, 'es-launch', 't-home')).map(message => message.text)).toEqual([
      expect.stringContaining('A stage gave src/space/pages/home/hero.ts to t-hero')
    ]);

    // What it named stays its own, and so does what it wrote in already.
    const named = await refusal(
      extendRun(
        lead(),
        'es-launch',
        await bench.writePlan({
          ...stage('t-home-2'),
          tasks: [{ ...hero, id: 't-home-2', files: ['src/space/pages/home/index.ts'] }]
        })
      )
    );
    expect(named.message).toContain('src/space/pages/home/index.ts is "t-home"\'s, still at work');
  });
});
