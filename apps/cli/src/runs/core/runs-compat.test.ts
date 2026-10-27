import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writtenByAnother } from './compat';
import { activeRunFile, runPaths, runsDir } from './paths';
import { RunRefusal } from './refusal';
import { CLI_VERSION } from '../../scaffold/project';
import { SRC_ROOT } from '../../tests/roots';
import { benchPlan, makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { finishRun } from '../copies/merge';
import { attachRun } from '../run';
import { answerProposal, proposeChange } from '../talk/proposals';
import { askLead, messageTasks, readInbox, tellLead } from '../talk/talk';
import { completeTask, nextTask, reviewTask, takeTask } from '../tasks';
import { viewRun } from '../view/view';

import type { Bench } from '../../tests/runProject';

/**
 * A run opened by an older CLI goes on with a newer one: `src/tests/runRecords/<version>/` keeps a run as each CLI wrote
 * it — a task done, one sent back, one in review with a request, a proposal answered and messages, one pending — and each
 * is read, worked and finished here. A change to what a run's file holds is additive, or one of these fails. Before a
 * release that changed a record, add this CLI's: WRITE_RUN_RECORDS=1 yarn vitest run src/runs/runs-compat.test.ts
 */

const RECORDS = path.join(SRC_ROOT, 'tests', 'runRecords');
const RUN = 'es-launch';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead } = runSteps(() => bench);

const versions = (await fs.readdir(RECORDS).catch(() => [])).sort();

/** An older CLI's run, put in the bench project as that CLI left it. */
const placeRun = async (version: string): Promise<void> => {
  await fs.cp(path.join(RECORDS, version, RUN), runPaths(bench.root, RUN).dir, { recursive: true });
  await fs.cp(path.join(RECORDS, version, '.plitzi'), path.join(bench.root, '.plitzi'), { recursive: true });
  await fs.writeFile(
    activeRunFile(bench.root),
    JSON.stringify({ runId: RUN, since: new Date().toISOString(), by: 'lead' })
  );
};

describe.each(versions)('a run %s wrote', version => {
  it('is read, worked and finished by this CLI', async () => {
    await placeRun(version);
    const view = await viewRun(lead(), RUN);
    expect(Object.fromEntries(view.tasks.map(task => [task.id, task.status]))).toEqual({
      't-home': 'in-review',
      't-menu': 'changes-requested',
      't-book': 'pending',
      't-about': 'done'
    });
    expect((await readInbox(lead(), RUN, undefined, true)).length).toBeGreaterThan(0);

    // Its copies were not kept with it: attached again, the tasks in hand start over from their reviewed versions.
    expect((await attachRun(lead(), RUN, false)).cut.sort()).toEqual(['t-home', 't-menu']);
    const menu = await takeTask(bench.agent('agent-2'), RUN, 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "La carta" };\n');
    await completeTask(bench.agent('agent-2', { token: menu.token }), RUN, 't-menu');
    await reviewTask(lead(), RUN, 't-menu', 'approve', []);
    expect((await nextTask(bench.agent('agent-9'), RUN)).ready).toContain('t-home');
    const home = await takeTask(bench.agent('agent-3'), RUN, 't-home');
    await completeTask(bench.agent('agent-3', { token: home.token }), RUN, 't-home');
    // What it asked before the upgrade is still asked: answered, then approved.
    await messageTasks(lead(), RUN, 't-home', 'Informal', 'm1');
    await reviewTask(lead(), RUN, 't-home', 'approve', []);
    // Both changed the shared index: its integration task puts them together.
    const integrate = await takeTask(bench.agent('agent-4'), RUN, 'integrate-src-space-index-ts');
    await writeInCopy(integrate.work, 'src/space/index.ts', 'export const space = { pages: ["home", "menu"] };\n');
    await completeTask(bench.agent('agent-4', { token: integrate.token }), RUN, 'integrate-src-space-index-ts');
    await reviewTask(lead(), RUN, 'integrate-src-space-index-ts', 'approve', []);

    const dry = await finishRun(bench.person(true), RUN, { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(
      expect.arrayContaining(['src/space/index.ts', 'src/space/pages/about.ts', 'src/space/pages/menu.ts'])
    );
  });
});

describe('a run’s file this CLI does not read', () => {
  it('is said as the other CLI’s, with the one to go on with — not as a hand edit', async () => {
    await placeRun(versions[0]);
    const record = path.join(runPaths(bench.root, RUN).dir, 'run.json');
    const raw: unknown = JSON.parse(await fs.readFile(record, 'utf-8'));
    await fs.writeFile(record, JSON.stringify({ ...(raw as object), pinned: { cli: '0.1.0', packages: {} } }));
    const file = path.join(runsDir(bench.root), RUN, 'tasks', 't-home', 'state.json');
    const said = await writtenByAnother(
      new RunRefusal('invalid', 'does not hold a task’s state', { file }),
      bench.root,
      CLI_VERSION
    );
    expect(said?.code).toBe('version-mismatch');
    expect(said?.message).toContain('written by @plitzi/cli 0.1.0');
    expect(said?.next).toBe(`npx -y @plitzi/cli@0.1.0 run status ${RUN}`);
    expect(
      await writtenByAnother(
        new RunRefusal('invalid', 'x', { file: path.join(bench.root, 'elsewhere.json') }),
        bench.root,
        CLI_VERSION
      )
    ).toBeUndefined();
  });
});

describe.runIf(process.env.WRITE_RUN_RECORDS === '1')('this CLI’s records', () => {
  it('are written for the CLIs after it', async () => {
    const { open, take } = runSteps(() => bench);
    await open(benchPlan(RUN));
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(about.ctx, RUN, 't-about');
    await reviewTask(lead(), RUN, 't-about', 'approve', [{ note: 'Reads well' }]);

    const menu = await take('agent-2', 't-menu');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await writeInCopy(menu.work, 'src/space/index.ts', 'export const space = { pages: ["menu"] };\n');
    await completeTask(menu.ctx, RUN, 't-menu');

    const home = await take('agent-3', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = { title: "Inicio" };\n');
    await writeInCopy(home.work, 'src/space/index.ts', 'export const space = { pages: ["home"] };\n');
    await proposeChange(home.ctx, RUN, 't-home', 't-menu', { change: 'Link home from the menu', wait: false });
    await askLead(home.ctx, RUN, 't-home', 'Formal or informal voice?');
    await tellLead(home.ctx, RUN, 't-home', 'The hero image has no alt');
    await completeTask(home.ctx, RUN, 't-home');
    await reviewTask(lead(), RUN, 't-menu', 'changes', [{ note: 'The title is cut at 390' }]);
    await answerProposal(menu.ctx, RUN, 't-home-p1', { verdict: 'accept', note: 'Done with the title' });

    const out = path.join(RECORDS, CLI_VERSION);
    await fs.rm(out, { recursive: true, force: true });
    // What a run keeps, not what it holds while it works: the copies and caches, and the locks of the moment.
    await fs.cp(runPaths(bench.root, RUN).dir, path.join(out, RUN), {
      recursive: true,
      filter: source =>
        !/[/\\]cache[/\\](work|checks|acceptance|preview|run)\b/.test(source) &&
        !/(state|merge|take|claim|review)\.lock$/.test(source)
    });
    await fs.cp(path.join(bench.root, '.plitzi'), path.join(out, '.plitzi'), { recursive: true });
  });
});
