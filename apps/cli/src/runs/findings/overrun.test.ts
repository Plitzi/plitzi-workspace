import { describe, expect, it } from 'vitest';

import { closeFindings, overrunFindings } from './overrun';
import { areaOfSaid } from './workarounds';
import { applyFacts, applyText } from '../reportApply';

import type { RunReport, TaskReport } from '../report';

const task = (over: Partial<TaskReport>): TaskReport => ({
  id: 't-visual-specs',
  title: 'The visual suite passes whole',
  kind: 'work',
  role: 'developer',
  status: 'done',
  agents: ['dev-1'],
  rounds: 2,
  estimateMinutes: 60,
  minutes: 148,
  files: ['playwright.config.ts', 'src/actions/skip.ts', 'a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
  cuts: 0,
  reviews: [{ round: 1, by: 'test-1', asked: 'Acceptance line 1 is not met' }],
  ...over
});

// encore-10, as its log kept it: the report said only "took 148 min of an estimated 60".
const log = [
  { at: '2026-10-26T17:00:50.000Z', by: 'dev-1', action: 'take', task: 't-visual-specs' },
  {
    at: '2026-10-26T17:23:07.000Z',
    by: 'lead',
    action: 'amend',
    tasks: [{ task: 't-visual-specs', changed: ['acceptance'] }]
  },
  { at: '2026-10-26T18:20:00.000Z', by: 'lead', action: 'extend', added: ['s-visual-speed'] },
  {
    at: '2026-10-26T18:25:22.000Z',
    by: 'test-1',
    action: 'review-escalated',
    task: 't-visual-specs',
    why: 'The acceptance’s third line rests on a false premise'
  },
  {
    at: '2026-10-26T18:25:43.000Z',
    by: 'lead',
    action: 'amend',
    tasks: [{ task: 't-visual-specs', changed: ['acceptance'] }]
  },
  { at: '2026-10-26T19:48:38.000Z', by: 'test-1', action: 'review', task: 't-visual-specs', verdict: 'changes' },
  { at: '2026-10-26T19:50:12.000Z', by: 'test-1', action: 'review', task: 't-visual-specs', verdict: 'approve' },
  {
    at: '2026-10-26T19:55:00.000Z',
    by: 'lead',
    action: 'amend',
    tasks: [{ task: 't-visual-specs', changed: ['acceptance'] }]
  },
  { at: '2026-10-26T20:32:19.000Z', by: 'test-1', action: 'all-approved', tasks: 10 },
  { at: '2026-10-26T20:37:01.000Z', by: 'lead', action: 'ready', files: 36, acceptance: 8 }
];

describe('a task that ran long, in the report', () => {
  it('says why, as the run kept it, and that nobody cut it', () => {
    const [finding] = overrunFindings([task({}), task({ id: 't-quick', minutes: 9, estimateMinutes: 40 })], log);

    expect(finding.title).toBe(
      't-visual-specs took 148 min of an estimated 60 — past the 10-minute piece of work 14 times'
    );
    expect(finding.evidence).toEqual([
      'its acceptance rewritten 3× (17:23, 18:25, 19:55 UTC)',
      'escalated at 18:25 UTC: The acceptance’s third line rests on a false premise',
      'sent back 1×: round 1, test-1: Acceptance line 1 is not met',
      'stacked beside it while it ran: s-visual-speed',
      '7 files: a scope wider than one piece of work',
      'never split, narrowed nor reassigned while it ran'
    ]);
    expect(finding.owner).toBe('lead');
  });
});

describe('the close', () => {
  it('is said only when the lead left the run open long past the last approval', () => {
    expect(closeFindings(log)).toEqual([]);
    const late = [...log.slice(0, -1), { ...log[log.length - 1], at: '2026-10-26T21:10:00.000Z' }];
    expect(closeFindings(late)[0]?.title).toBe(
      'Every task was approved at 20:32 UTC; the run was ready to apply 38 min later'
    );
  });
});

describe('the report, before a person applies it', () => {
  it('says the finish’s dry run and what weighs on applying it', () => {
    const report = {
      runId: 'encore-10',
      tasks: [task({ design: 'UI by the lead', id: 't-sign-in-next' }), task({ knownFailure: 'two gated tests' })],
      noticed: ['A closed room sends its visitor home'],
      findings: [],
      apply: applyFacts(log)
    } as unknown as RunReport; // The parts of a report this section reads; the rest is none of its.

    expect(report.apply?.amendedDone).toEqual(['t-visual-specs']);
    const text = applyText(report, false).join('\n');
    expect(text).toContain("The finish's dry run passed** at 20:37 UTC: 36 files to write, 8 acceptance lines held");
    expect(text).toContain('t-visual-specs was approved over a known failure: two gated tests');
    expect(text).toContain("t-sign-in-next's UI was approved by the lead, no designer's review");
    expect(text).toContain('rewritten after approval — the finish held them to the new lines: t-visual-specs');
    expect(text).toContain('`plitzi run finish encore-10 --apply`');
    expect(applyText({ ...report, apply: { amendedDone: [] } }, false).join('\n')).toContain(
      'The finish has not passed its dry run'
    );
  });
});

describe('what was said of Plitzi, by its part', () => {
  it('is placed by the words it names most', () => {
    expect(
      areaOfSaid(
        'sdk-server’s serveProject opens a file kv at PLITZI_KV_FILE on every start, and keeps jobs.json beside it'
      )
    ).toBe('platform');
    expect(areaOfSaid('page play --read on an element inside a list reads only the first row')).toBe('cli');
    expect(areaOfSaid('templates.md says it is readable everywhere; the docs never say the access rule')).toBe('docs');
  });
});
