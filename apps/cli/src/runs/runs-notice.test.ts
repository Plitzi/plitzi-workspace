import fs from 'node:fs/promises';
import path from 'node:path';

import { format } from 'prettier';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addBacklogItem, BACKLOG_FILE, backlogOfPlan, closeBacklogItem, openBacklog } from './backlog';
import { feedbackFile } from './feedback';
import { abortRun, finishRun } from './merge';
import { noticeRun, noticesOf } from './notices';
import { buildReport, reportText } from './report';
import { loadRun, readRunLog } from './run';
import { readInbox } from './talk';
import { REPORTS_DIR } from '../scaffold/paths';
import { qualityFilesFor } from '../scaffold/quality';
import { benchPlan, makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';
import type { Options } from 'prettier';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

// la-velada: an empty cell of the stats grid, seen in two runs and noted "predates this task" in a review each time.
describe('run notice', () => {
  it('keeps what an agent saw that no task owns — the lead hears it, the report lists it', async () => {
    const runId = await open();
    const menu = await take('agent-1', 't-menu');

    await noticeRun(menu.ctx, runId, 'The stats grid leaves an empty cell at 1440', {
      task: 't-menu',
      on: '/boxeadores/:id'
    });
    await noticeRun(lead(), runId, 'The footer’s legal line wraps at 390');

    const loaded = await loadRun(lead(), runId);
    expect(await noticesOf(loaded)).toMatchObject([
      { by: 'agent-1', task: 't-menu', on: '/boxeadores/:id', text: 'The stats grid leaves an empty cell at 1440' },
      { by: 'lead', text: 'The footer’s legal line wraps at 390' }
    ]);
    expect((await readRunLog(loaded.paths)).filter(entry => entry.action === 'notice')).toHaveLength(2);
    // For the next stage, not for now: nothing is sent to the lead, which a message would wake.
    expect(await readInbox(lead(), runId)).toEqual([]);

    const text = reportText(await buildReport(lead(), loaded), undefined);
    expect(text).toContain('## Noticed, owned by no task');
    expect(text).toContain('- The footer’s legal line wraps at 390 — lead');
  });

  it('refuses one that says nothing, and one from an agent of no team', async () => {
    const runId = await open();

    expect((await refusal(noticeRun(lead(), runId, '  '))).message).toContain('Say what is wrong');
    expect((await refusal(noticeRun(bench.agent('stranger'), runId, 'A broken link'))).message).toContain(
      'no agent of the team'
    );
  });
});

// Carlos: the lead listed what it found wrong with Plitzi in a journal of its own; the run writes it as feedback to share.
describe('the run’s feedback to Plitzi', () => {
  it('keeps what is noticed of Plitzi out of the backlog, and writes it with the run’s measures as it ends', async () => {
    const runId = await open();
    await noticeRun(lead(), runId, 'page measure reads no position, and every agent wrote a script for it', {
      plitzi: true
    });
    await noticeRun(lead(), runId, 'The footer’s legal line wraps at 390');
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const finished = await finishRun(bench.person(true), runId, { apply: true, leavePending: true });

    expect(finished.backlog).toEqual(['b-1']);
    // Said apart at the finish: what is Plitzi's is never listed as the project's next stage (lx-controls).
    expect(finished.noticed).toEqual(['The footer’s legal line wraps at 390 — lead']);
    expect(finished.findings.filter(each => each.kind === 'said').map(each => [each.owner, each.title])).toEqual([
      ['plitzi', 'page measure reads no position, and every agent wrote a script for it']
    ]);
    expect((await openBacklog(bench.root)).map(item => item.text)).toEqual(['The footer’s legal line wraps at 390']);
    const feedback = await fs.readFile(feedbackFile(bench.root, runId), 'utf-8');
    expect(feedback).toContain(`# Plitzi feedback — run ${runId}`);
    expect(feedback).toContain('**page measure reads no position, and every agent wrote a script for it**');
    expect(feedback).not.toContain('The footer’s legal line');
    expect(feedback).not.toContain(bench.root);
  });

  // lx-product: the feedback lx-controls left ended in a blank line, and the project's format check refused the next run.
  it('leaves the backlog as the project’s Prettier writes it, and its reports where no check reads', async () => {
    const runId = await open();
    await noticeRun(lead(), runId, 'page measure reads no position', { plitzi: true });
    await noticeRun(lead(), runId, 'The footer’s legal line wraps at 390', { on: '/ #footer' });
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const finished = await finishRun(bench.person(true), runId, { apply: true, leavePending: true });
    const options = JSON.parse(qualityFilesFor('node', [])['.prettierrc']) as Options;

    const backlog = path.join(bench.root, BACKLOG_FILE);
    const text = await fs.readFile(backlog, 'utf-8');
    expect(await format(text, { ...options, filepath: backlog })).toBe(text);
    // The reports are where the scaffold's ignores leave them alone (`create.test.ts`).
    expect(path.relative(bench.root, finished.report?.dir ?? '').startsWith(`${REPORTS_DIR}/`)).toBe(true);
  });
});

// Carlos: what a run leaves is noted for the next — velada-polish's lead had it nowhere the next run reads.
describe('the project’s backlog', () => {
  it('keeps what a run noticed past the run, once, for the next run — open until one says it is done', async () => {
    const runId = await open();
    await noticeRun(lead(), runId, 'The FAQ pill does not name the visitor’s zone', { on: '/ #home-faq' });
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    const finished = await finishRun(bench.person(true), runId, { apply: true, leavePending: true });
    expect(finished.backlog).toEqual(['b-1']);
    expect(await openBacklog(bench.root)).toEqual([
      expect.objectContaining({ id: 'b-1', on: '/ #home-faq', from: runId, by: 'lead' })
    ]);

    // Noticed again by the next run — a run of its own name, the first's reports kept by theirs: kept once.
    const again = await open({ ...benchPlan(), runId: `${runId}-2` });
    await noticeRun(lead(), again, 'The FAQ pill does not name the visitor’s zone', { on: '/ #home-faq' });
    await abortRun(bench.person(true), again);
    expect(await openBacklog(bench.root)).toHaveLength(1);

    // Done, said how: closed, and kept as done.
    expect(await closeBacklogItem(lead(), 'b-1', 'lead', 'a client piece reads the zone')).toMatchObject({
      done: { by: 'lead', note: 'a client piece reads the zone' }
    });
    expect(await openBacklog(bench.root)).toEqual([]);
    expect(await refusal(closeBacklogItem(lead(), 'b-1', 'lead'))).toMatchObject({ code: 'invalid' });
  });

  // Carlos: the backlog kept through the CLI, read when a plan is written, so the lead takes it up.
  it('takes an item with no run open, and closes it when a run whose task says it does it is applied', async () => {
    expect(await addBacklogItem(bench.person(true), { text: 'The cart says no total', by: 'person' })).toMatchObject({
      id: 'b-1',
      from: 'no run'
    });
    expect(
      await refusal(addBacklogItem(bench.person(true), { text: 'The cart says no total', by: 'person' }))
    ).toMatchObject({ code: 'invalid' });

    const unknown = benchPlan();
    unknown.tasks[3] = { ...unknown.tasks[3], closes: ['b-9'] };
    expect((await refusal(open(unknown))).message).toContain('b-9 is no open item of the backlog');

    const plan = benchPlan();
    plan.tasks[3] = { ...plan.tasks[3], closes: ['b-1'] };
    // encore-5's plan closed all five open items, and `run plan` still listed them as open, to take up.
    await addBacklogItem(bench.person(true), { text: 'The footer wraps', by: 'person' });
    expect(await backlogOfPlan(bench.root, plan.tasks)).toEqual({
      taken: [{ item: expect.objectContaining({ id: 'b-1' }) as unknown, task: plan.tasks[3].id }],
      untaken: [expect.objectContaining({ id: 'b-2' })]
    });
    const runId = await open(plan);
    await doTask('agent-1', plan.tasks[3].id, plan.tasks[3].files[0], 'export const about = { total: true };\n');
    const finished = await finishRun(bench.person(true), runId, { apply: true, leavePending: true });

    expect(finished.closedBacklog).toEqual(['b-1']);
    expect((await openBacklog(bench.root)).map(item => item.id)).toEqual(['b-2']);
  });
});
