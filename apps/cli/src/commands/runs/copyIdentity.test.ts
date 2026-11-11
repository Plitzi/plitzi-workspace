import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { COPY_TASK_FILE } from '../../core/paths';
import { STARTER_TEAM } from '../../core/team';
import { plitzi } from '../../tests/plitziProcess';
import { benchPlan, makeBench } from '../../tests/runProject';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
  await bench.writeTeam(STARTER_TEAM);
});

afterEach(async () => {
  await bench.cleanup();
});

// A run's agent ran `rm -rf tmp` in its copy to clear test bundles, and the copy lost who it was.
describe('a copy whose tmp/ was cleared', () => {
  it('knows its task again, written back from the run, and says so', async () => {
    expect((await plitzi(bench.root, ['run', 'open', await bench.writePlan(benchPlan())])).code).toBe(0);
    const taken = await plitzi(bench.root, ['task', 'next', 't-about', '--agent', 'dev-1']);
    const work = String(taken.json.work);
    const token = (await bench.read('tmp/plitzi-runs/es-launch/scratch/dev-1/token'))?.trim() ?? '';
    await fs.rm(path.join(work, 'tmp'), { recursive: true, force: true });

    const context = await plitzi(work, ['task', 'context'], { PLITZI_TOKEN: token });

    expect(context.code).toBe(0);
    expect(context.json).toMatchObject({ task: { id: 't-about' } });
    expect(context.stderr).toContain(`${COPY_TASK_FILE} was gone from this copy`);
    expect(JSON.parse(await fs.readFile(path.join(work, COPY_TASK_FILE), 'utf-8'))).toMatchObject({
      run: 'es-launch',
      task: 't-about',
      agent: 'dev-1'
    });
  }, 120_000);
});
