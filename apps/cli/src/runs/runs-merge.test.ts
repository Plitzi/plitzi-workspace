import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeAtomic } from './files';
import { abortRun, continueRun, finishRun, resolveFile, restoreFile, showVersion } from './merge';
import { BACKUPS_DIR, REPORTS_DIR, RUNS_DIR, runPaths } from './paths';
import { completeTask, revertTask, reviewTask, takeTask } from './tasks';
import { benchPlan, makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** The run into the project: the final merge, undone, and its report. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

describe('the final merge', () => {
  it('shows the whole run as a dry run — changing nothing — and only a person writes it', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { id: 'about', title: 'Sobre nosotros' };
`
    );
    const before = await bench.read('src/space/pages/about.ts');

    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/about.ts']);
    expect(await bench.read('src/space/pages/about.ts')).toBe(before);
    expect((await refusal(finishRun(bench.person(false), 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'person-only'
    );

    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre nosotros');
    // Its work is in the project: the run is gone, backups and all, and nothing is left for anyone to clean up.
    expect(done.backup).toBeUndefined();
    expect(await fs.readdir(path.join(bench.root, RUNS_DIR))).toEqual([]);
    expect(await fs.stat(path.join(bench.root, BACKUPS_DIR)).catch(() => undefined)).toBeUndefined();
  });

  it('keeps the files it overwrote only when asked, as plain files a person copies back', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true, backup: true });

    expect(done.backup?.startsWith(path.join(bench.root, BACKUPS_DIR, 'es-launch-'))).toBe(true);
    expect(await fs.readFile(path.join(String(done.backup), 'files/src/space/pages/about.ts'), 'utf-8')).toMatch(
      /title: .About./
    );
    const manifest = JSON.parse(await fs.readFile(path.join(String(done.backup), 'manifest.json'), 'utf-8')) as {
      overwritten: string[];
      created: string[];
    };
    expect(manifest).toMatchObject({ overwritten: ['src/space/pages/about.ts'], created: [] });
    expect(await fs.readdir(path.join(bench.root, RUNS_DIR))).toEqual([]);
  });

  it('refuses the merge while tasks are in hand, and checks the whole result before writing', async () => {
    await open();
    await take('agent-1', 't-home');
    expect(
      (await refusal(finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true }))).message
    ).toContain('still in hand');
  });

  it('a person’s change on a file the run changed: reconciliation, nothing written; the person decides', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'About us — by a person' };
`
    );

    expect((await refusal(finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true }))).code).toBe(
      'reconciliation'
    );
    expect(await bench.read('src/space/pages/about.ts')).toContain('by a person');
    expect((await refusal(takeTask(bench.agent('agent-2'), 'es-launch', 't-menu'))).code).toBe('reconciliation');
    expect((await showVersion(bench.person(), 'es-launch', 'src/space/pages/about.ts', 'run'))?.toString()).toContain(
      'Sobre nosotros'
    );

    await resolveFile(bench.person(true), 'es-launch', 'src/space/pages/about.ts', 'project');
    await continueRun(bench.person(true), 'es-launch');
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(done.plan.apply).toEqual([]);
    expect(await bench.read('src/space/pages/about.ts')).toContain('by a person');
  });

  it('resolving with the run’s version writes it at the next finish', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'edited' };
`
    );
    await refusal(finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true }));
    await resolveFile(bench.person(true), 'es-launch', 'src/space/pages/about.ts', 'run');
    await continueRun(bench.person(true), 'es-launch');
    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });

    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre nosotros');
  });

  it('aborting writes nothing, says what it discards, and leaves nothing behind', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    const aborted = await abortRun(bench.person(true), 'es-launch');

    expect(aborted.discarded).toEqual(['src/space/pages/about.ts']);
    expect(await bench.read('src/space/pages/about.ts')).toMatch(/title: .About./);
    expect(await fs.readdir(path.join(bench.root, RUNS_DIR))).toEqual([]);
  });
});

describe('undoing', () => {
  it('reverts one task in the run’s work, the others untouched', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    await doTask(
      'agent-2',
      't-menu',
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { title: 'Carta', theme };
`
    );
    const reverted = await revertTask(lead(), 'es-launch', 't-about', 'not wanted after all');

    expect(reverted.reverted).toEqual(['src/space/pages/about.ts']);
    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/menu.ts']);
  });

  it('puts one file back from the run’s opening backup', async () => {
    await open();
    await bench.write('src/space/pages/about.ts', 'broken by accident\n');
    await restoreFile(bench.person(true), 'es-launch', 'src/space/pages/about.ts', 'base');

    expect(await bench.read('src/space/pages/about.ts')).toMatch(/title: .About./);
  });

  it('a merge cut half-way is undone from its own journal before the next one goes in', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    const paths = runPaths(bench.root, 'es-launch');
    const original = (await bench.read('src/space/tokens.ts')) ?? '';
    await bench.write('src/space/tokens.ts', 'half-written by a cut merge\n');
    const { digest } = await import('../commands/spaceOrigin');
    await fs.mkdir(path.join(paths.blobs), { recursive: true });
    await fs.writeFile(path.join(paths.blobs, digest(original)), original);
    await writeAtomic(
      path.join(paths.merges, 'merge_9.json'),
      JSON.stringify({
        id: 'merge_9',
        kind: 'finish',
        at: bench.now().toISOString(),
        complete: false,
        files: { 'src/space/tokens.ts': { before: digest(original), after: digest('half-written by a cut merge\n') } }
      })
    );

    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await bench.read('src/space/tokens.ts')).toBe(original);
    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre');
  });
});

describe('the run’s report', () => {
  it('the final merge waits for the lead’s summary', async () => {
    await open(benchPlan(), { summary: false });
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );

    const refused = await refusal(finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true }));
    expect(refused.message).toContain('has no report yet');
  });

  it('is left when the run ends: the summary, the problems, every task, and what was written', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'BROKEN\n');
    await refusal(completeTask(home.ctx, 'es-launch', 't-home'));
    await writeInCopy(
      home.work,
      'src/space/pages/home/hero.ts',
      `export const hero = { text: 'Hola' };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });

    expect(done.report?.startsWith(path.join(bench.root, REPORTS_DIR, 'es-launch-'))).toBe(true);
    const report = await fs.readFile(String(done.report), 'utf-8');
    expect(report).toContain('Translated the pages; nothing left.');
    expect(report).toContain('The project’s checks failed 1 time(s)');
    expect(report).toContain('| t-home | developer | done | agent-1 |');
    expect(report).toContain('t-menu did not finish');
    expect(report).toContain('- src/space/pages/home/hero.ts');
  });

  it('is left when a person aborts it too', async () => {
    await open(benchPlan(), { summary: false });
    const aborted = await abortRun(bench.person(true), 'es-launch');

    expect(await fs.readFile(aborted.report, 'utf-8')).toContain('_None was written._');
  });
});
