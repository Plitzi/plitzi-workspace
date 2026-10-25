import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { proposalsOf } from './agreements';
import { continueRun, finishRun, resolveFile } from './merge';
import { answerProposal, proposeChange } from './proposals';
import { loadRun } from './run';
import { completeTask, reviewTask, taskContext } from './tasks';
import { viewRun } from './view';
import { makeBench, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** Tasks agreeing with each other, and the file as the agent found it. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

describe('tasks agreeing with each other', () => {
  it('a task proposes, waits, gets a counter, agrees — and the other cannot go to review leaving it unanswered', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    const proposed = await proposeChange(home.ctx, 'es-launch', 't-home', 't-menu', {
      change: 'The menu links back to home with a `lang` param',
      about: 'src/space/pages/menu.ts',
      wait: true
    });
    expect(proposed.proposal.id).toBe('t-home-p1');
    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'proposal')).toBe(true);

    await writeInCopy(
      menu.work,
      'src/space/pages/menu.ts',
      `export const menu = { title: 'Carta' };
`
    );
    const refused = await refusal(completeTask(menu.ctx, 'es-launch', 't-menu'));
    expect(refused.message).toContain('proposals to answer first: t-home-p1');

    const countered = await answerProposal(menu.ctx, 'es-launch', 't-home-p1', {
      verdict: 'counter',
      counter: 'A `lang` field in the shared tokens instead'
    });
    expect(countered.counter?.id).toBe('t-menu-p1');
    expect((await viewRun(lead(), 'es-launch')).tasks.find(task => task.id === 't-home')?.status).toBe('in-progress');

    await answerProposal(home.ctx, 'es-launch', 't-menu-p1', { verdict: 'accept' });
    await completeTask(menu.ctx, 'es-launch', 't-menu');
    const context = await taskContext(menu.ctx, 'es-launch', 't-menu');
    expect(context.proposals.agreements.map(each => each.id)).toEqual(['t-menu-p1']);
  });

  // encore-3: dev-1 waited on a task that ran only after its own, past its harness's timeout, with nothing said.
  it('refuses a wait on a task that runs after this one, leaving no proposal behind', async () => {
    await open();
    const home = await take('agent-1', 't-home');

    expect(
      (await refusal(proposeChange(home.ctx, 'es-launch', 't-home', 't-book', { change: 'x', wait: true }))).message
    ).toContain('t-book runs after t-home');
    expect(await proposalsOf(await loadRun(lead(), 'es-launch'))).toEqual([]);
  });

  it('refuses a wait for an answer that would close a cycle, and a proposal to a task that is done', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await proposeChange(home.ctx, 'es-launch', 't-home', 't-menu', { change: 'x', wait: true });

    expect(
      (await refusal(proposeChange(menu.ctx, 'es-launch', 't-menu', 't-home', { change: 'y', wait: true }))).message
    ).toContain('cycle');
    await doTask(
      'agent-3',
      't-about',
      'src/space/pages/about.ts',
      `export const about = {};
`
    );
    expect(
      (await refusal(proposeChange(menu.ctx, 'es-launch', 't-menu', 't-about', { change: 'z', wait: false }))).message
    ).toContain('is done');
  });

  it('after three rounds of counters the lead decides; a rejection says why', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const menu = await take('agent-2', 't-menu');
    await proposeChange(home.ctx, 'es-launch', 't-home', 't-menu', { change: 'one', wait: false });
    await answerProposal(menu.ctx, 'es-launch', 't-home-p1', { verdict: 'counter', counter: 'two' });
    await answerProposal(home.ctx, 'es-launch', 't-menu-p1', { verdict: 'counter', counter: 'three' });

    expect(
      (await refusal(answerProposal(menu.ctx, 'es-launch', 't-home-p2', { verdict: 'counter', counter: 'four' })))
        .message
    ).toContain('the lead decides');
    expect((await refusal(answerProposal(lead(), 'es-launch', 't-home-p2', { verdict: 'reject' }))).message).toContain(
      'says why'
    );
    await answerProposal(lead(), 'es-launch', 't-home-p2', {
      verdict: 'reject',
      note: 'tokens stay as they are'
    });
  });
});

describe('before writing: the file as the agent found it', () => {
  it('refuses to approve over a change made in the project meanwhile; the lead overwrites it with a notice, and the other version is kept', async () => {
    await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(
      about.work,
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre nosotros' };
`
    );
    await completeTask(about.ctx, 'es-launch', 't-about');
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'About — a person, meanwhile' };
`
    );

    const refused = await refusal(reviewTask(lead(), 'es-launch', 't-about', 'approve', []));
    expect(refused.code).toBe('conflict');
    expect(refused.message).toContain('changed in the project while task "t-about" worked on it');
    expect(refused.message).toContain('--overwrite');

    await reviewTask(lead(), 'es-launch', 't-about', 'approve', [], 'overwrite');
    const view = await viewRun(lead(), 'es-launch');
    expect(view.attention.some(item => item.kind === 'overwrite')).toBe(true);

    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(done.plan.overwrites.map(each => each.file)).toEqual(['src/space/pages/about.ts']);
    expect(await bench.read('src/space/pages/about.ts')).toContain('Sobre nosotros');
    expect(await fs.readFile(path.join(String(done.backup), 'files/src/space/pages/about.ts'), 'utf-8')).toContain(
      'a person, meanwhile'
    );
  });

  it('a change made in the project meanwhile that merges line by line is offered, and --merge keeps both', async () => {
    await open();
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    const about = await take('agent-1', 't-about');
    await writeInCopy(
      about.work,
      'src/space/pages/about.ts',
      'export const title = 2;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    await completeTask(about.ctx, 'es-launch', 't-about');
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 3;\n'
    );

    const refused = await refusal(reviewTask(lead(), 'es-launch', 't-about', 'approve', []));
    expect(refused.message).toContain('--merge');
    expect(refused.detail).toMatchObject({ decide: ['--merge', '--overwrite', '--changes'] });

    const approved = await reviewTask(lead(), 'es-launch', 't-about', 'approve', [], 'merge');
    expect(approved.joined).toEqual(['src/space/pages/about.ts']);
    const done = await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(done.plan.overwrites).toEqual([]);
    expect(await bench.read('src/space/pages/about.ts')).toBe(
      'export const title = 2;\nexport const body = 1;\nexport const foot = 3;\n'
    );
  });

  it('a reconciliation whose two changes touch different lines is resolved with both', async () => {
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      'export const title = 2;\nexport const body = 1;\nexport const foot = 1;\n'
    );
    await bench.write(
      'src/space/pages/about.ts',
      'export const title = 1;\nexport const body = 1;\nexport const foot = 3;\n'
    );
    await refusal(finishRun(lead(), 'es-launch', { apply: false, leavePending: true }));

    expect((await resolveFile(lead(), 'es-launch', 'src/space/pages/about.ts', 'merge')).resolved).toBe('merged');
    await continueRun(lead(), 'es-launch');
    await finishRun(bench.person(true), 'es-launch', { apply: true, leavePending: true });
    expect(await bench.read('src/space/pages/about.ts')).toBe(
      'export const title = 2;\nexport const body = 1;\nexport const foot = 3;\n'
    );
  });

  it('the lead resolves a reconciliation too, and taking the run’s version leaves the notice', async () => {
    await open();
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      `export const about = { title: 'Sobre' };
`
    );
    await bench.write(
      'src/space/pages/about.ts',
      `export const about = { title: 'edited after approval' };
`
    );
    // The dry run already says it, before any check runs over a mix of the two that would never exist.
    expect((await refusal(finishRun(lead(), 'es-launch', { apply: false, leavePending: true }))).code).toBe(
      'reconciliation'
    );
    await resolveFile(lead(), 'es-launch', 'src/space/pages/about.ts', 'run');
    await continueRun(lead(), 'es-launch');

    const dry = await finishRun(bench.person(true), 'es-launch', { apply: false, leavePending: true });
    expect(dry.plan.overwrites).toMatchObject([{ file: 'src/space/pages/about.ts', by: 'lead' }]);
  });
});
