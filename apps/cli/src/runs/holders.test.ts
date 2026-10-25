import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extendRun } from './extend';
import { completeTask } from './tasks';
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

const { lead, open, take } = runSteps(() => bench);

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

    const completed = await completeTask(about.ctx, runId, 't-about');
    expect(completed.changed).toEqual(expect.arrayContaining(['src/space/pages/aboutParts.ts']));
  });
});
