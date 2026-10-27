import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openRun } from './run';
import { showTask } from './show';
import { completeTask } from './tasks';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** `task show` answered up to 44k characters — eighteen files of eighty lines — read 77 times by its reviewers. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

const hundredLines = (name: string) =>
  `${Array.from({ length: 100 }, (_, index) => `export const ${name}${String(index)} = ${String(index)};`).join('\n')}\n`;

describe('a task shown', () => {
  it('shows its diffs up to a total, and says each file past it with how to read it — whole with --full, as many as one answer holds', async () => {
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const home = await take('agent-1', 't-home');
    const files = ['a', 'b', 'c', 'd', 'e', 'f'].map(name => `src/space/pages/home/${name}.ts`);
    for (const [index, file] of files.entries()) {
      await writeInCopy(home.work, file, hundredLines(`v${String(index)}`));
    }

    await completeTask(home.ctx, 'es-launch', 't-home');

    const shown = await showTask(lead(), 'es-launch', 't-home');
    const lines = shown.files.reduce((all, each) => all + (each.diff?.split('\n').length ?? 0), 0);
    expect(lines).toBeLessThanOrEqual(240);
    const withheld = shown.files.filter(each => each.withheld !== undefined);
    expect(withheld.length).toBeGreaterThan(0);
    expect(withheld.every(each => (each.withheld ?? 0) > 100)).toBe(true);

    // Six files of a hundred lines are 20k characters of diff: a run's `--full` answered 34k, read again on every turn.
    const whole = await showTask(lead(), 'es-launch', 't-home', { full: true });
    const diffs = whole.files.flatMap(each => (each.diff === undefined ? [] : [each.diff]));
    expect(whole.files.every(each => each.more === undefined)).toBe(true);
    expect(diffs.length).toBeGreaterThan(2);
    expect(diffs.join('\n').length).toBeLessThanOrEqual(12_000);
    expect(whole.files.filter(each => each.withheld !== undefined).length).toBe(files.length - diffs.length);
  });

  // A tester was told a 123-line file was "not shown" under --full: a large file before it had spent the answer.
  it('fits the most files whole under --full, the smallest first, each where it was listed', async () => {
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const home = await take('agent-1', 't-home');
    const big = `${Array.from({ length: 400 }, (_, index) => `export const big${String(index)} = ${String(index)};`).join('\n')}\n`;
    await writeInCopy(home.work, 'src/space/pages/home/a-big.ts', big);
    await writeInCopy(home.work, 'src/space/pages/home/b-small.ts', hundredLines('small'));
    await completeTask(home.ctx, 'es-launch', 't-home');

    const whole = await showTask(lead(), 'es-launch', 't-home', { full: true });
    expect(whole.files.map(each => [each.file, each.diff === undefined ? 'withheld' : 'whole'])).toEqual([
      ['src/space/pages/home/a-big.ts', 'withheld'],
      ['src/space/pages/home/b-small.ts', 'whole']
    ]);
  });

  // A tests card named two test files and wrote a third: a reviewer saw it only by setting the two lists side by side.
  it('says the files its card names that its work did not write', async () => {
    const plan = benchPlan();
    plan.tasks[0] = { ...plan.tasks[0], files: [...plan.tasks[0].files, 'src/space/pages/home/named.ts'] };
    await openRun(lead(), await bench.writePlan(plan));
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', hundredLines('home'));
    await completeTask(home.ctx, 'es-launch', 't-home');

    expect((await showTask(lead(), 'es-launch', 't-home')).unwritten).toEqual([
      'src/space/pages/home/hero.ts',
      'src/space/pages/home/named.ts'
    ]);
  });

  // Design-2's `task show` of another task offered `task message`, which an agent's token is refused.
  it('offers an agent of the team its own next steps, the lead the lead’s', async () => {
    await openRun(lead(), await bench.writePlan(benchPlan()));
    await take('agent-1', 't-home');

    expect((await showTask(lead(), 'es-launch', 't-home')).next[0]).toContain('plitzi task message t-home');
    const asked = await showTask(bench.agent('agent-2'), 'es-launch', 't-home');
    expect(asked.next.join('\n')).toContain('plitzi task tell --about t-home');
    expect(asked.next.join('\n')).not.toContain('task message');
  });
});
