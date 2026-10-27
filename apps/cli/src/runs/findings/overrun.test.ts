import { describe, expect, it } from 'vitest';

import { factFindings } from './facts';
import { closeFindings, overrunFindings } from './overrun';
import { areaOfSaid } from './workarounds';
import { applyFacts, applyText, weighedLines } from '../report/reportApply';

import type { RunReport, TaskReport } from '../report/report';

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

// a run, as its log kept it: the report said only "took 148 min of an estimated 60".
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
  {
    at: '2026-10-26T19:50:12.000Z',
    by: 'test-1',
    action: 'review',
    task: 't-visual-specs',
    verdict: 'approve',
    merged: []
  },
  {
    at: '2026-10-26T19:55:00.000Z',
    by: 'lead',
    action: 'amend',
    tasks: [{ task: 't-visual-specs', changed: ['acceptance'] }]
  },
  { at: '2026-10-26T20:32:19.000Z', by: 'test-1', action: 'all-approved', tasks: 10 },
  {
    at: '2026-10-26T20:37:01.000Z',
    by: 'lead',
    action: 'ready',
    files: 36,
    acceptance: 8,
    again: [{ task: 't-a11y', said: 'The keyboard test passes', why: '1) a11y.spec.ts:85 › the room by keyboard' }],
    slow: [{ task: 't-a11y', said: 'The keyboard test passes', ms: 546_000 }]
  }
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
    expect(closeFindings(log, '2026-10-26T22:00:00.000Z')).toEqual([]);
    const late = [...log.slice(0, -1), { ...log[log.length - 1], at: '2026-10-26T21:10:00.000Z' }];
    expect(closeFindings(late, '2026-10-26T22:00:00.000Z')[0]?.title).toBe(
      'Every task was approved at 20:32 UTC; the run was ready to apply 38 min later'
    );
    // Before the finish, measured to now: on its way at first, past its time later.
    const open = log.slice(0, -1);
    expect(closeFindings(open, '2026-10-26T20:40:00.000Z')).toEqual([]);
    expect(closeFindings(open, '2026-10-26T21:00:00.000Z')[0]?.title).toBe(
      "Every task was approved at 20:32 UTC, and 28 min later the finish's dry run had not passed"
    );
  });
});

describe('the report, before a person applies it', () => {
  it('says the finish’s dry run and what weighs on applying it', () => {
    const report = {
      runId: 'run-10',
      tasks: [
        task({ reviewedBy: ['tester: test-1'], id: 't-sign-in-next' }),
        task({ knownFailure: 'two gated tests' })
      ],
      noticed: ['A closed room sends its visitor home'],
      findings: [],
      apply: applyFacts(log)
    } as unknown as RunReport; // The parts of a report this section reads; the rest is none of its.

    expect(report.apply?.amendedDone).toEqual(['t-visual-specs']);
    const text = applyText(report, false).join('\n');
    expect(text).toContain("The finish's dry run passed** at 20:37 UTC: 36 files to write, 8 acceptance lines held");
    expect(text).toContain('t-visual-specs was approved over a known failure: two gated tests');
    expect(text).toContain('rewritten after approval — the finish held them to the new lines: t-visual-specs');
    expect(text).toContain('`plitzi run finish run-10 --apply`');
    // A run's finish took ten minutes on one line that failed once: said where the apply is decided.
    expect(text).toContain(
      '**Held only when run again**: t-a11y: "The keyboard test passes" — the first run said: 1) a11y.spec.ts:85'
    );
    expect(text).toContain('**Slow**: t-a11y: "The keyboard test passes" took 9.1 min in the dry run');
    // As the finish keeps them with ready, off its lines' results.
    expect(
      weighedLines([
        {
          task: 't-a11y',
          said: 'The keyboard test passes',
          firstFailed: ['    Error: not visible', '  3 passed (9.1m)'],
          ms: 546_000
        },
        { task: 't-home', said: 'Home reads' }
      ])
    ).toEqual({
      again: [{ task: 't-a11y', said: 'The keyboard test passes', why: 'Error: not visible' }],
      slow: [{ task: 't-a11y', said: 'The keyboard test passes', ms: 546_000 }]
    });
    expect(applyText({ ...report, apply: { amendedDone: [] } }, false).join('\n')).toContain(
      'The finish has not passed its dry run'
    );
  });
});

// A run's "The run took 96 min of an estimated 51": 48 of them the person's wait to apply; its work took 36.
describe('a run past its estimate', () => {
  const report = (metrics: Partial<RunReport['metrics']>, minutes: number) =>
    ({
      tasks: [],
      events: { completed: 0, refused: 0, checksFailed: 0, conflicts: 0 },
      overwrites: [],
      joined: [],
      stops: [],
      proposals: [],
      minutes,
      estimate: { wallMinutes: 51, totalMinutes: 135, agents: 5 },
      metrics
    }) as unknown as RunReport; // The parts of a report the facts read; the rest is none of theirs.

  it('is measured to ready to apply — never the person’s wait after', () => {
    expect(factFindings(report({ workMinutes: 36.2, closeMinutes: 11.4 }, 96))).toEqual([]);
    expect(factFindings(report({ workMinutes: 70, closeMinutes: 15 }, 120))[0]?.title).toBe(
      'The run took 85 min to ready of an estimated 51'
    );
    // Not ready yet: measured to now.
    expect(factFindings(report({ workMinutes: 70 }, 90))[0]?.title).toBe(
      'The run took 90 min to ready of an estimated 51'
    );
  });

  it('points at Plitzi’s problems where they are read before the apply, and at feedback.md after it', () => {
    const before = applyText(
      { runId: 'r', tasks: [], noticed: [], findings: [{ owner: 'plitzi' }] } as unknown as RunReport, // As above.
      false
    ).join('\n');
    expect(before).toContain('plitzi run report --plitzi');
    expect(
      applyText(
        { runId: 'r', tasks: [], noticed: [], findings: [{ owner: 'plitzi' }] } as unknown as RunReport,
        true
      ).join('\n')
    ).toContain('`feedback.md` beside this report');
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
