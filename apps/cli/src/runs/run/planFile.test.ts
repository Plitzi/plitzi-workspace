import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readPlanFile } from './open';

const folders: string[] = [];

afterEach(async () => {
  for (const folder of folders.splice(0)) {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

// Two plans in a row were refused for each task's `dependsOn` left out — a lead's stage and a person's plan.
describe('a plan whose task waits for none', () => {
  it('may leave dependsOn out: it waits for none', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-plan-'));
    folders.push(dir);
    const file = path.join(dir, 'plan.json');
    await fs.writeFile(
      file,
      JSON.stringify({
        version: 1,
        runId: 'polish',
        goal: 'Polish',
        tasks: [
          { id: 't-a', title: 'A', files: ['src/a.ts'], priority: 'high', estimateMinutes: 10, acceptance: ['A'] }
        ]
      })
    );

    expect((await readPlanFile(file)).tasks[0]?.dependsOn).toEqual([]);
  });
});
