import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { briefOf } from './brief';
import { openRun } from '../../runs/run';
import { completeTask, noteTask, reviewTask, taskContext } from '../../runs/tasks';
import { setTeamAgent } from '../../runs/team';
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

  // encore-3: developers wrote tests into a tests card's file and learnt it at task check, the writing lost.
  it('says another task’s file beside the task’s own — its tests, a tester’s', async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'] });
    await setTeamAgent(bench.root, 'test', { roles: ['tester'] });
    const plan = benchPlan();
    plan.tasks[0].files.push('src/functions/book.ts');
    // The team as set, a tester in it: what makes a tests card of t-home.
    const { runId } = (await openRun(lead(), await bench.writePlan({ ...plan, designReview: false }))).checked;

    const brief = stripVTControlCharacters(briefOf(await taskContext(lead(), runId, 't-home')));
    expect(brief).toContain(
      "Beside them, another task's — write nothing there: src/functions/book.test.ts (t-home-tests, a tester's)"
    );
  });

  // encore-4: a tester's brief said how format.ts was called before the run — its copy held the developer's change.
  it('reads the rest of the project from the task’s copy while it holds one', async () => {
    const runId = await open(benchPlan());
    expect((await taskContext(lead(), runId, 't-home')).sourceRoot).toBe(bench.root);

    const held = await take('agent-1', 't-home');
    expect((await taskContext(held.ctx, runId, 't-home')).sourceRoot).toBe(held.work);
  });

  // encore-4: a tester told its test file was near the limit wrote a new one beside it, unsure the new file was its own.
  it('says a new file beside a file near the limit is the task’s', async () => {
    const runId = await open(benchPlan());
    const held = await take('agent-1', 't-home');
    await writeInCopy(
      held.work,
      'src/space/pages/home/index.ts',
      `${Array.from({ length: 360 }, (_, index) => `export const v${String(index)} = ${String(index)};`).join('\n')}\n`
    );

    const brief = stripVTControlCharacters(briefOf(await taskContext(held.ctx, runId, 't-home')));
    expect(brief).toContain('a new file is yours (no task holds it; it goes in with your complete)');
  });
});
