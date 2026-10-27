import { describe, expect, it } from 'vitest';

import { openUnanswered, unansweredLines } from './unansweredLines';

const unanswered = (task: string, check: string) => ({
  at: '2026-10-27T09:52:00.000Z',
  by: 'dev-1',
  action: 'line-unanswered',
  task,
  said: 'Home checks whole',
  check,
  why: 'Error: state/jobs.json is in use by process 57261'
});

// encore-12's dev-1 waited on two lines nothing could answer: the lead's to amend, told in a note it was not woken for.
describe('a line nothing can answer', () => {
  it('wakes the lead once a line — its task approved or not — until that task’s acceptance is amended', () => {
    const log = [
      unanswered('t-card', 'plitzi page check / /rooms'),
      unanswered('t-card', 'plitzi page check / /rooms'),
      unanswered('t-menu', 'plitzi page check /menu')
    ];
    expect(unansweredLines(log)).toEqual([
      expect.objectContaining({ kind: 'line-unanswered', task: 't-card', who: 'lead' }),
      expect.objectContaining({ kind: 'line-unanswered', task: 't-menu' })
    ]);
    expect(unansweredLines(log)[0]?.text).toContain('amend the line (plitzi run amend)');

    const amended = [...log, { action: 'amend', tasks: [{ task: 't-card', changed: ['acceptance'] }] }];
    expect([...openUnanswered(amended).values()].map(line => line.task)).toEqual(['t-menu']);
  });
});
