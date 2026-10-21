import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { noticeRun, noticesOf } from './notices';
import { buildReport, reportText } from './report';
import { loadRun, readRunLog } from './run';
import { readInbox } from './talk';
import { makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take } = runSteps(() => bench);

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
    // The agent's reaches the lead now; the lead's own is not sent to itself.
    expect((await readInbox(lead(), runId)).map(message => message.text)).toEqual([
      'Noticed, owned by no task: The stats grid leaves an empty cell at 1440 (on /boxeadores/:id) — agent-1, at t-menu'
    ]);

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
