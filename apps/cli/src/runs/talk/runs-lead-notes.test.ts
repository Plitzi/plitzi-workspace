import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { tellLead } from './talk';
import { makeBench, writeInCopy } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { waitForLead } from '../agents/leadWatch';
import { completeTask } from '../tasks';
import { viewRun } from '../view/view';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

describe('a note to the lead, only to know', () => {
  // Carlos: what the lead looked at is gone from what needs it — a note only to know, shown whole, is read.
  it('shows a note only to know whole in the watch, and reads it: it needs the lead no more', async () => {
    await open();
    const home = await take('agent-1', 't-home');
    const note = `The hero now reads in Spanish. ${'And more. '.repeat(40)}`;
    await tellLead(home.ctx, 'es-launch', 't-home', note);

    const woke = await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 });
    // Brought as the watch ends, never waking the lead: a run's lead was woken three times for notes.
    expect(woke.timedOut).toBe(true);
    expect(woke.fresh.map(item => item.text)).toContainEqual(expect.stringContaining(note.trim()));
    expect((await viewRun(lead(), 'es-launch')).attention.some(item => item.kind === 'message')).toBe(false);

    // With what wakes it, it comes along.
    await tellLead(home.ctx, 'es-launch', 't-home', 'The menu link stays');
    await writeInCopy(home.work, 'src/space/pages/home/index.ts', 'export const home = { es: true };\n');
    await completeTask(home.ctx, 'es-launch', 't-home');
    const both = await waitForLead(lead(), 'es-launch', { timeoutMs: 20, everyMs: 10 });
    expect(both.timedOut).toBeUndefined();
    expect(both.fresh.map(item => item.text)).toContainEqual(expect.stringContaining('The menu link stays'));
  });
});
