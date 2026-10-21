import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditRun } from './audit';
import { runPaths } from './paths';
import { loadRun } from './run';
import { makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** A run's activity read before it closes: what was out of place in how it was worked. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, doTask } = runSteps(() => bench);

const logged = async (entries: Record<string, unknown>[]): Promise<void> => {
  await fs.appendFile(
    runPaths(bench.root, 'es-launch').log,
    entries.map(entry => `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`).join('')
  );
};

describe('a run’s audit', () => {
  it('says the loops, the crashes and the brake — and nothing for a run worked as it should', async () => {
    await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    expect(await auditRun(await loadRun(lead(), 'es-launch'))).toEqual([]);

    const refused = { by: 'dev-1', action: 'refused', code: 'claimed', command: 'plitzi task next --take' };
    await logged([
      refused,
      refused,
      refused,
      { by: 'lead', action: 'crashed', command: 'plitzi task review t-menu --approve', error: 'Error: EISDIR' },
      { by: 'dev-2', action: 'brake', reason: '10 failed checks or conflicts within 30 minutes' }
    ]);
    const findings = await auditRun(await loadRun(lead(), 'es-launch'));
    expect(findings).toEqual([
      expect.stringContaining('crashed'),
      expect.stringContaining('The brake stopped the run'),
      'Refused 3 times over: dev-1 · claimed · plitzi task next'
    ]);
  });
});
