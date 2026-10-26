import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { keptPlan } from './plan';
import { runPaths } from '../../runs/paths';

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// A run's lead edited the plan the run keeps and ran `run amend` alone: refused for a missing argument.
describe('run amend with no plan named', () => {
  it('reads the plan the run keeps in its inputs — and says which to name when it keeps none, or several', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-amend-'));
    roots.push(root);
    const inputs = path.join(runPaths(root, 'es-launch').dir, 'inputs');
    await fs.mkdir(inputs, { recursive: true });

    await expect(keptPlan({ root }, 'es-launch')).rejects.toThrow('keeps no plan in its inputs');
    await fs.writeFile(path.join(inputs, 'plan.json'), '{}');
    await fs.writeFile(path.join(inputs, 'primer.md'), '');
    expect(await keptPlan({ root }, 'es-launch')).toBe(path.join(inputs, 'plan.json'));
    await fs.writeFile(path.join(inputs, 'other.json'), '{}');
    await expect(keptPlan({ root }, 'es-launch')).rejects.toThrow('keeps 2 plans in its inputs');
  });
});
