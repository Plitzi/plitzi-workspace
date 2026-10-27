import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkTask } from '.';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { backupFiles, backupText } from '../copies/strays';
import { openRun } from '../run';

import type { Bench } from '../../tests/runProject';

/** The files `--fix` is handed: what the linter and the formatter may rewrite. */
const handed: string[][] = [];
vi.mock('./fix', () => ({
  fixChanged: (_work: string, _root: string, files: readonly string[]) => {
    handed.push([...files]);

    return Promise.resolve({ fixed: [], ran: [] });
  }
}));

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
  handed.length = 0;
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, take } = runSteps(() => bench);

// Dev-2's `task check --fix` rewrote avatar.ts, a file another task held, and only then refused it.
describe('task check --fix', () => {
  it('fixes the task’s own files, never one another task holds', async () => {
    const plan = benchPlan();
    const file = await bench.writePlan(plan);
    await bench.writeTeam(teamFor(plan, 2));
    const { runId } = (await openRun(lead(), file)).checked;
    await take('agent-2', 't-menu');
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = {};\n');
    await writeInCopy(home.work, 'src/space/pages/menu.ts', 'export const menu = {};\n');

    await checkTask(home.ctx, runId, 't-home', { fix: true });

    expect(handed).toEqual([['src/space/pages/home/index.ts']]);
  });

  // Dev-1 checked twelve times in nine minutes — a check run again with nothing changed answers the same.
  it('says a failure is the same as the last one, on the same files', async () => {
    const plan = benchPlan();
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = BROKEN;\n');

    const first = await checkTask(home.ctx, runId, 't-home');
    const again = await checkTask(home.ctx, runId, 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = BROKEN; // another try\n');
    const changed = await checkTask(home.ctx, runId, 't-home');

    expect(first.ok).toBe(false);
    expect(first.failedAlikeAt).toBeUndefined();
    expect(again.failedAlikeAt).toBeDefined();
    expect(changed.failedAlikeAt).toBeUndefined();
  });

  // `sed -i -E` on macOS left roomBrowse.test.ts-E, which went to review as a file of the task's.
  it('fails on a backup an editor left among its files, saying how to put it back', async () => {
    const plan = benchPlan();
    const { runId } = (await openRun(lead(), await bench.writePlan(plan))).checked;
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = {};\n');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts-E', 'export const home = {};\n');

    const checked = await checkTask(home.ctx, runId, 't-home');

    expect(checked.ok).toBe(false);
    expect(checked.backups).toEqual(['src/space/pages/home/index.ts-E']);
    expect(backupText('src/space/pages/home/index.ts-E')).toContain(
      'plitzi task discard src/space/pages/home/index.ts-E'
    );
    expect(backupFiles(['src/a.ts', 'src/b.test.ts~', 'src/c.json.orig', 'src/d.ts-E', 'src/e-final.ts'])).toEqual([
      'src/b.test.ts~',
      'src/c.json.orig',
      'src/d.ts-E'
    ]);
  });
});
