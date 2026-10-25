import fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { finishRun } from './merge';
import { taskPaths } from './paths';
import { loadRun, readApproved } from './run';
import { checkTask, claimFile, completeTask, requestShared, reviewTask, taskContext, waitForFile } from './tasks';
import { viewRun } from './view';
import { makeBench, readInCopy, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** Shared files: taken by turns, waited for, and changed by request. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

describe('shared files: turns, waits and requests', () => {
  it('takes a shared file by turns; the next waits, and gets it with the approved version', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    expect(await claimFile(home.ctx, 'es-launch', 't-home', 'src/space/theme.ts')).toMatchObject({ granted: true });

    const refused = await refusal(claimFile(menu.ctx, 'es-launch', 't-menu', 'src/space/theme.ts'));
    expect(refused.code).toBe('claimed');
    expect(refused.detail).toMatchObject({ holder: 't-home', turn: 'wait' });
    await waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/theme.ts');

    await writeInCopy(
      home.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink, lang: 'es' } };
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    const approved = await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);

    expect(approved.granted).toEqual(['src/space/theme.ts → t-menu']);
    expect(await readInCopy(menu.work, 'src/space/theme.ts')).toMatch(/lang: .es./);
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-menu')?.status).toBe('in-progress');
  });

  it('refuses the wait that would close a cycle, naming it', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await waitForFile(home.ctx, 'es-launch', 't-home', 'src/space/pages/menu.ts');

    const refused = await refusal(waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/pages/home/hero.ts'));
    expect(refused.code).toBe('invalid');
    expect(refused.message).toContain('t-menu waits for t-home waits for t-menu');
  });

  it('the first to complete takes a free shared file by turns; the same lines changed by another make an integration task', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await requestShared(home.ctx, 'es-launch', 't-home', 'src/space/theme.ts', {
      summary: 'A badge for the language',
      usedIn: ['src/space/pages/home/index.ts'],
      blocking: false
    });
    await writeInCopy(
      home.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, badge: {} };
`
    );
    await writeInCopy(
      menu.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, price: {} };
`
    );
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { id: 'menu', title: 'Carta', theme };
`
    );

    expect((await completeTask(home.ctx, 'es-launch', 't-home')).claimed).toEqual(['src/space/theme.ts']);
    expect((await completeTask(menu.ctx, 'es-launch', 't-menu')).requests.map(each => each.file)).toEqual([
      'src/space/theme.ts'
    ]);
    expect((await reviewTask(lead(), 'es-launch', 't-home', 'approve', [])).integrations).toEqual([]);
    const approved = await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    expect(approved.integrations).toEqual(['integrate-src-space-theme-ts']);
    const refused = await refusal(finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true }));
    expect(refused.message).toContain('Requests on shared files are not integrated');

    const integrator = await take('agent-3', 'integrate-src-space-theme-ts');
    const context = await taskContext(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts');
    expect(context.requests.map(each => each.task)).toEqual(['t-menu']);
    expect(context.requests[0].diff).toContain('+export const theme = { card: { color: tokens.ink }, price: {} };');
    await writeInCopy(
      integrator.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, badge: {}, price: {} };
`
    );
    await completeTask(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts');
    await reviewTask(lead(), 'es-launch', 'integrate-src-space-theme-ts', 'approve', []);

    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.apply.map(each => each.file)).toEqual(['src/space/pages/menu.ts', 'src/space/theme.ts']);
  });

  // T-shell's new files went in unchecked, reading keys its request held; the request waited for an
  // integration, and every copy made after failed its checks until three integration tasks put them back together.
  it('never merges files that read what their request holds without it — refused, naming the checks and the file', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await writeInCopy(
      home.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, badge: {} };
`
    );
    await writeInCopy(
      menu.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, price: {} }; // HAS:price
`
    );
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { id: 'menu', title: 'Carta', price: theme }; // NEEDS:price
`
    );
    await completeTask(home.ctx, 'es-launch', 't-home');
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);

    const refused = await refusal(reviewTask(lead(), 'es-launch', 't-menu', 'approve', []));
    expect(refused.code).toBe('conflict');
    expect(refused.message).toContain("fail the project's checks (author) without what it asked of src/space/theme.ts");
    const approved = await readApproved((await loadRun(lead(), 'es-launch')).paths);
    expect(Object.keys(approved.files)).not.toContain('src/space/pages/menu.ts');
  });

  // One integration a file made t-shell's requests on site.json, tokens.ts and index.ts three tasks, each
  // failing for want of the others' — a cycle the lead broke by approving one with a failure.
  it('integrates one task’s requests on several files as one task', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    for (const [held, key] of [
      [home, 'badge'],
      [menu, 'price']
    ] as const) {
      await writeInCopy(
        held.work,
        'src/space/theme.ts',
        `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, ${key}: {} };
`
      );
      await writeInCopy(held.work, 'src/space/tokens.ts', `export const tokens = { ink: '#111', ${key}: '#222' };\n`);
    }

    await completeTask(home.ctx, 'es-launch', 't-home');
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    const approved = await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);

    expect(approved.integrations).toEqual(['integrate-src-space-theme-ts-and-1']);
    const integrator = await take('agent-3', 'integrate-src-space-theme-ts-and-1');
    const context = await taskContext(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts-and-1');
    expect(context.requests.map(each => each.file).sort()).toEqual(['src/space/theme.ts', 'src/space/tokens.ts']);
  });

  it('merges a task’s files and its request together when they only author together', async () => {
    await open();
    const menu = await take('agent-2', 't-menu');
    await writeInCopy(
      menu.work,
      'src/space/theme.ts',
      `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, price: {} }; // HAS:price
`
    );
    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      `import { theme } from '../theme.ts';

export const menu = { id: 'menu', title: 'Carta', price: theme }; // NEEDS:price
`
    );
    const home = await take('agent-1', 't-home');
    expect(await claimFile(home.ctx, 'es-launch', 't-home', 'src/space/theme.ts')).toMatchObject({ granted: true });
    await completeTask(menu.ctx, 'es-launch', 't-menu');

    const approved = await reviewTask(lead(), 'es-launch', 't-menu', 'approve', []);
    expect(approved.integrations).toEqual([]);
    const files = (await readApproved((await loadRun(lead(), 'es-launch')).paths)).files;
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['src/space/pages/menu.ts', 'src/space/theme.ts']));
  });

  it('a shared file waiting for its integration stays shared: taken by turns meanwhile, and one integration a file', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    for (const [held, key] of [
      [home, 'badge'],
      [menu, 'price']
    ] as const) {
      await writeInCopy(
        held.work,
        'src/space/theme.ts',
        `import { tokens } from './tokens.ts';

export const theme = { card: { color: tokens.ink }, ${key}: {} };
`
      );
      await completeTask(held.ctx, 'es-launch', held === home ? 't-home' : 't-menu');
    }

    await reviewTask(lead(), 'es-launch', 't-home', 'approve', []);
    expect((await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).integrations).toEqual([
      'integrate-src-space-theme-ts'
    ]);

    const about = await take('agent-3', 't-about');
    const theme = (await readInCopy(about.work, 'src/space/theme.ts')) ?? '';
    await writeInCopy(about.work, 'src/space/theme.ts', `${theme}export const aboutTone = 'warm';\n`);
    expect((await completeTask(about.ctx, 'es-launch', 't-about')).claimed).toEqual(['src/space/theme.ts']);
    await reviewTask(lead(), 'es-launch', 't-about', 'approve', []);

    const book = await take('agent-4', 't-book');
    const asked = await requestShared(book.ctx, 'es-launch', 't-book', 'src/space/theme.ts', {
      summary: 'A card for the booking form',
      usedIn: [],
      blocking: true
    });
    expect(asked.integration).toBe('integrate-src-space-theme-ts');
    expect(asked.request.wanted).toBe(asked.request.base);
    const integrator = await take('agent-5', 'integrate-src-space-theme-ts');
    const context = await taskContext(integrator.ctx, 'es-launch', 'integrate-src-space-theme-ts');
    expect(context.requests.map(each => each.task)).toEqual(['t-menu', 't-book']);
    expect(await readInCopy(integrator.work, 'src/space/theme.ts')).toMatch(/aboutTone = .warm./);
  });

  it('a file no task at work holds — a done task’s, or in no task of the plan — is taken by turns at complete', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = ${JSON.stringify({ id: 'about', title: 'Sobre' })};\n`
    );
    const home = await take('agent-2', 't-home');
    const menu = await take('agent-3', 't-menu');
    await writeInCopy(
      home.work,
      'src/space/pages/about.ts',
      `export const about = ${JSON.stringify({ id: 'about', title: 'Nosotros' })};\n`
    );
    await writeInCopy(home.work, 'src/data/menu.json', `${JSON.stringify({ items: ['paella'] })}\n`);
    await writeInCopy(home.work, 'src/space/pages/home/hero.ts', 'export const hero = {};\n');

    expect((await completeTask(home.ctx, 'es-launch', 't-home')).claimed.sort()).toEqual([
      'src/data/menu.json',
      'src/space/pages/about.ts'
    ]);
    await writeInCopy(menu.work, 'src/data/menu.json', `${JSON.stringify({ items: ['tortilla'] })}\n`);
    await writeInCopy(menu.work, 'src/space/pages/home/hero.ts', 'export const hero = { text: 1 };\n');
    const refused = await refusal(completeTask(menu.ctx, 'es-launch', 't-menu'));
    expect(refused.message).toContain('src/space/pages/home/hero.ts (task "t-home"');
  });

  // T-sponsors approved with its tokens a request on the theme t-home held — the run's work read tokens it
  // lacked, and every task's check failed on them until nobody could complete.
  it('merges a request at its approval though another task holds the file — the holder’s copy brings it', async () => {
    await open();
    const holder = await take('agent-1', 't-home');
    await claimFile(holder.ctx, 'es-launch', 't-home', 'src/space/theme.ts');
    const menu = await take('agent-2', 't-menu');
    const theme = (await readInCopy(menu.work, 'src/space/theme.ts')) ?? '';
    await writeInCopy(menu.work, 'src/space/theme.ts', `${theme}export const price = {};\n`);
    expect((await completeTask(menu.ctx, 'es-launch', 't-menu')).requests.map(each => each.file)).toEqual([
      'src/space/theme.ts'
    ]);
    expect((await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [])).verdict).toBe('approve');
    const run = await loadRun(lead(), 'es-launch');
    expect((await readApproved(run.paths)).files['src/space/theme.ts']).toMatchObject({ task: 't-menu' });
    // Its holder goes on with the run's version under its own change.
    const mine = (await readInCopy(holder.work, 'src/space/theme.ts')) ?? '';
    await writeInCopy(holder.work, 'src/space/theme.ts', `export const home = {};\n${mine}`);
    await checkTask(holder.ctx, 'es-launch', 't-home');
    const merged = (await readInCopy(holder.work, 'src/space/theme.ts')) ?? '';
    expect(merged).toContain('export const price = {};');
    expect(merged).toContain('export const home = {};');
  });

  // T-blog, sent back and taken by another agent, came back without its site.json request — author failed.
  it('keeps a task sent back with its requests, at the version it asked, for a copy made again', async () => {
    await open();
    const holder = await take('agent-1', 't-home');
    await claimFile(holder.ctx, 'es-launch', 't-home', 'src/space/theme.ts');
    const menu = await take('agent-2', 't-menu');
    const theme = (await readInCopy(menu.work, 'src/space/theme.ts')) ?? '';
    await writeInCopy(menu.work, 'src/space/theme.ts', `${theme}export const price = {};\n`);
    const [asked] = (await completeTask(menu.ctx, 'es-launch', 't-menu')).requests;
    await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Say the price' }]);

    const run = await loadRun(lead(), 'es-launch');
    const reviewed: unknown = JSON.parse(await fs.readFile(taskPaths(run.paths, 't-menu').reviewed, 'utf-8'));
    expect(reviewed).toMatchObject({ files: { 'src/space/theme.ts': asked.wanted } });
  });

  // Dev-1's wait for sponsors.ts ran out, t-heading stayed waiting, and no complete was let through.
  it('completes a task that waited for a file and does without it, out of the queue', async () => {
    await open();
    const holder = await take('agent-1', 't-home');
    await claimFile(holder.ctx, 'es-launch', 't-home', 'src/space/theme.ts');
    const menu = await take('agent-2', 't-menu');
    await waitForFile(menu.ctx, 'es-launch', 't-menu', 'src/space/theme.ts');
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { es: true };\n');

    await completeTask(menu.ctx, 'es-launch', 't-menu');
    const line = (await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-menu');
    expect(line?.status).toBe('in-review');
    expect(line).not.toHaveProperty('waitingFor');
  });

  it('a blocking request makes its integration task at once, and the task waits only for it', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const asked = await requestShared(home.ctx, 'es-launch', 't-home', 'src/space/tokens.ts', {
      summary: 'A token for the accent, which does not exist yet',
      usedIn: [],
      blocking: true
    });

    expect(asked.integration).toBe('integrate-src-space-tokens-ts');
    const integrator = await take('agent-2', 'integrate-src-space-tokens-ts');
    await writeInCopy(
      integrator.work,
      'src/space/tokens.ts',
      `export const tokens = { ink: '#111', accent: '#c60' };
`
    );
    await completeTask(integrator.ctx, 'es-launch', 'integrate-src-space-tokens-ts');
    const approved = await reviewTask(lead(), 'es-launch', 'integrate-src-space-tokens-ts', 'approve', []);

    expect(approved.granted).toEqual(['src/space/tokens.ts → t-home']);
    expect(await readInCopy(home.work, 'src/space/tokens.ts')).toContain('accent');
  });
});
