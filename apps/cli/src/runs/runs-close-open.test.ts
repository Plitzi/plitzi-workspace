import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPaths } from './paths';
import { writeSummary } from './report';
import { openRun } from './run';
import { settleFinding } from './settle';
import { benchPlan, makeBench } from '../tests/runProject';
import { LEAD_SAID, runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/**
 * A run's lead said the run was done with ten notices standing, and stacked a stage after. Every task done, the lead
 * closes what it was told first: its summary is refused while anything waits for it.
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, doTask, refusal } = runSteps(() => bench);

describe("the lead's close", () => {
  it('is refused while something waits for the lead, every task done — and taken once it is settled', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = plan.tasks.filter(task => task.id === 't-home');
    await openRun(lead(), await bench.writePlan(plan));
    await doTask('agent-1', 't-home', 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await bench.write('summary.md', '# Done\n');
    // Something left in the project's tmp/ while the run is open: the lead's to settle.
    await bench.write('tmp/notes/draft.md', 'a note\n');

    const refused = await refusal(writeSummary(lead(), 'es-launch', 'summary.md', LEAD_SAID));
    expect(refused.code).toBe('invalid');
    expect(refused.message).toContain("not the lead's to close yet");
    expect(refused.message).toContain('tmp/notes');

    await fs.rm(path.join(bench.root, 'tmp/notes'), { recursive: true });
    await writeSummary(lead(), 'es-launch', 'summary.md', LEAD_SAID);
  });

  // Two agents went on after "You can stop", a finding no task holds — no approval settles it, and the close
  // waited on it with nothing the lead could do. The lead says what it did about it, and only then closes.
  it('waits on a finding no task holds until the lead says what it did about it', async () => {
    const plan = benchPlan();
    plan.designReview = false;
    plan.tasks = plan.tasks.filter(task => task.id === 't-home');
    await openRun(lead(), await bench.writePlan(plan));
    await doTask('agent-1', 't-home', 'src/space/pages/home/hero.ts', 'export const hero = {};\n');
    await bench.write('summary.md', '# Done\n');
    const { dir } = runPaths(bench.root, 'es-launch');
    const usage = (at: string, command: string) =>
      `${JSON.stringify({ at, by: 'agent-9', command, chars: 10, ms: 5, code: 0, session: 's-9' })}\n`;
    await fs.appendFile(path.join(dir, 'usage.jsonl'), usage('2026-10-24T10:00:00.000Z', 'plitzi task next'));
    await fs.appendFile(
      path.join(dir, 'log.jsonl'),
      `${JSON.stringify({ at: '2026-10-24T10:01:00.000Z', by: 'agent-9', action: 'stops', why: 'You can stop' })}\n`
    );
    await fs.appendFile(path.join(dir, 'usage.jsonl'), usage('2026-10-24T10:02:00.000Z', 'plitzi page check /'));

    const held = await refusal(writeSummary(lead(), 'es-launch', 'summary.md', LEAD_SAID));
    expect(held.message).toContain('agent-9 went on in the same session');
    expect(held.message).toContain('plitzi run settle after-stop:agent-9');

    expect((await refusal(settleFinding(lead(), 'es-launch', 'after-stop:agent-9', ' '))).code).toBe('invalid');
    const unknown = await refusal(settleFinding(lead(), 'es-launch', 'after-stop:agent-1', 'looked'));
    expect(unknown.code).toBe('not-found');
    expect(unknown.message).toContain('after-stop:agent-9');

    await settleFinding(lead(), 'es-launch', 'after-stop:agent-9', 'In flight when it was told: nothing written');
    const log = await fs.readFile(path.join(dir, 'log.jsonl'), 'utf8');
    expect(log).toContain('"note":"In flight when it was told: nothing written"');
    await writeSummary(lead(), 'es-launch', 'summary.md', LEAD_SAID);
  });
});
