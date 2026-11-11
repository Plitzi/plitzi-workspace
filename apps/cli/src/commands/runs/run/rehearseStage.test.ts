import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REFUSAL_EXIT_CODES } from '../../../core/refusal';
import { plitzi } from '../../../tests/plitziProcess';
import { benchPlan, makeBench } from '../../../tests/runProject';
import { runSteps } from '../../../tests/runSteps';

import type { Bench } from '../../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { open } = runSteps(() => bench);

// A run's lead added --rehearse to its scope's proposal — a stage, its tasks alone — and was told it was "not a plan".
describe('a stage rehearsed while its run is open', () => {
  it('is refused with the command that sees it, never as a plan that is not one', async () => {
    await open(benchPlan());
    const stage = path.join(bench.root, 'stage.json');
    const tasks = {
      tasks: [
        {
          id: 't-contact',
          title: 'Contact',
          files: ['src/space/pages/contact.ts'],
          dependsOn: [],
          priority: 'low',
          estimateMinutes: 10,
          acceptance: ['It says how to reach us']
        }
      ]
    };
    await fs.writeFile(stage, JSON.stringify(tasks));

    const said = await plitzi(bench.root, ['run', 'open', stage, '--dry-run', '--rehearse'], {}, { json: false });

    expect(said.code).toBe(REFUSAL_EXIT_CODES.invalid);
    expect(said.stderr).toContain('is a stage of the open run');
    expect(said.stderr).toContain(`plitzi run open ${stage} --dry-run`);
    expect(said.stderr).not.toContain('is not a plan');
  }, 60_000);
});
