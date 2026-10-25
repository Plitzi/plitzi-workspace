import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extendRun } from './extend';
import { claimFile, completeTask, waitForFile } from './tasks';
import { makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** Who holds a file a task changes: never a task that waits for the one changing it. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, refusal, take } = runSteps(() => bench);

describe('a file a task makes, named by a task that waits for it', () => {
  // A stage stacked after t-follow-api named profileSeed.ts, the file t-follow-api made; its complete was
  // refused as another task's at work, while the stacked task could never start before it — both waited for ever.
  it('is the making task’s to complete with: the one after takes it once it is done', async () => {
    const runId = await open();
    const after = {
      version: 1 as const,
      runId: 'es-launch-2',
      goal: 'One source for the about page',
      tasks: [
        {
          id: 't-about-parts',
          title: 'The about page reads its parts from one module',
          files: ['src/space/pages/aboutParts.ts', 'src/space/pages/about.ts'],
          dependsOn: ['t-about'],
          priority: 'low' as const,
          estimateMinutes: 10,
          acceptance: ['The parts are said once']
        }
      ]
    };
    await extendRun(lead(), runId, await bench.writePlan(after));

    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', "import { parts } from './aboutParts.ts';\n");
    await writeInCopy(about.work, 'src/space/pages/aboutParts.ts', 'export const parts = [];\n');

    // Waited for, it is not the later task's to hand on: a run's task waited on a file it made, refused as a loop.
    expect(await waitForFile(about.ctx, runId, 't-about', 'src/space/pages/aboutParts.ts')).toMatchObject({
      granted: true
    });

    const completed = await completeTask(about.ctx, runId, 't-about');
    expect(completed.changed).toEqual(expect.arrayContaining(['src/space/pages/aboutParts.ts']));
  });
});

// t-model's contract change broke a file of a task nobody had taken; its one-line fix had no way in — a claim was refused
// as that task's, and amend could not give it the file.
describe('a file of a task nobody has taken', () => {
  it('is claimed by turns ahead of it, said — and refused once that task is taken', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');

    expect(await claimFile(home.ctx, runId, 't-home', 'src/space/pages/menu.ts')).toEqual({
      file: 'src/space/pages/menu.ts',
      granted: true,
      aheadOf: 't-menu'
    });
    await take('agent-2', 't-about');
    expect((await refusal(claimFile(home.ctx, runId, 't-home', 'src/space/pages/about.ts'))).message).toContain(
      'is task "t-about"\'s'
    );
  });

  it('is named in complete’s refusal of a change to it, with the claim that takes it ahead', async () => {
    const runId = await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');

    expect((await refusal(completeTask(home.ctx, runId, 't-home'))).message).toContain(
      'Nobody has taken the task of src/space/pages/menu.ts yet: plitzi task claim src/space/pages/menu.ts takes it ahead of it, your change kept — then complete again.'
    );
    await claimFile(home.ctx, runId, 't-home', 'src/space/pages/menu.ts');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = {};\n');
    expect((await completeTask(home.ctx, runId, 't-home')).changed).toEqual(
      expect.arrayContaining(['src/space/pages/menu.ts'])
    );
  });
});
