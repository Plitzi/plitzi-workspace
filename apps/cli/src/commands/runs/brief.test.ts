import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { briefOf } from './brief';
import { completeTask, noteTask, reviewTask, taskContext } from '../../runs/tasks';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

describe("a task's brief", () => {
  // encore-3's briefs ran to 17k characters, read again every turn: 4k of it what the tasks before were asked and how
  // their reviews went, and notes that restated whole amendments.
  it('says what a task before it was asked, not its reviews, and a long note in part', async () => {
    const plan = benchPlan();
    const home = plan.tasks.find(task => task.id === 't-home');
    if (!home) {
      throw new Error('the bench plan has no t-home');
    }

    home.acceptance = Array.from({ length: 8 }, (_, index) => `Home line ${String(index + 1)} reads in Spanish`);
    const runId = await open(plan);
    const held = await take('agent-1', 't-home');
    await writeInCopy(held.work, 'src/space/pages/home/index.ts', 'export const home = { es: true };\n');
    await completeTask(held.ctx, runId, 't-home');
    await reviewTask(lead(), runId, 't-home', 'changes', [{ note: 'The hero is still in English at 390' }]);
    await completeTask(held.ctx, runId, 't-home');
    await reviewTask(lead(), runId, 't-home', 'approve', []);
    await noteTask(lead(), runId, 't-book', `Keep the formal voice. ${'Every page says usted. '.repeat(30)}`);

    const brief = stripVTControlCharacters(briefOf(await taskContext(lead(), runId, 't-book')));
    const asked = brief.slice(brief.indexOf('What t-home was asked'));
    expect(asked).toContain('Home line 6 reads in Spanish');
    expect(asked).not.toContain('Home line 7 reads in Spanish');
    expect(asked).toContain('… 2 more: plitzi task show t-home');
    expect(asked).not.toContain('The hero is still in English');
    const note = brief.split('\n').find(line => line.includes('Keep the formal voice')) ?? '';
    expect(note.length).toBeLessThan(400);
    expect(note).toContain('(whole: --json)');
  });
});
