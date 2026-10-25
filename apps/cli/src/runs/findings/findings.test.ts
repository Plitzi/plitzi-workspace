import { describe, expect, it } from 'vitest';

import { brokeApproved, flakyChecks, linesAmended, linesFailing, stepsFailing } from './checks';
import { costFindings } from './cost';
import { errorFindings } from './errors';
import { explainFindings } from './explain';
import { indicatorsOf, liveFindings, runFindings } from './index';
import { afterStop, twoSessions, twoTasks } from './sessions';
import { groupAlike } from './words';
import { saidFindings, workaroundFindings } from './workarounds';

import type { LogEntry } from './types';
import type { RunTask } from '../model';
import type { TaskRoundReport } from '../taskReports';
import type { UsageLine } from '../usage';

/** A run's records as two of them were, reduced to what each pattern is read from. */

const T = (minute: number): string => new Date(Date.UTC(2026, 9, 24, 10, minute)).toISOString();

const use = (minute: number, by: string, command: string, more: Partial<UsageLine> = {}): UsageLine => ({
  at: T(minute),
  by,
  command,
  chars: 100,
  ms: 1000,
  code: 0,
  ...more
});

describe('how tasks and sessions were held', () => {
  // Dev-1's sent-back task waited for it while it was at another — Carlos's rule — and read as two at once.
  it('says an agent with two tasks in progress once a pair, never a sent-back one waiting for it', () => {
    const log: LogEntry[] = [
      { at: T(1), by: 'dev-1', action: 'take', task: 't-live' },
      { at: T(2), by: 'dev-1', action: 'complete', task: 't-live' },
      { at: T(3), by: 'dev-1', action: 'take', task: 't-settings' },
      { at: T(4), by: 'lead', action: 'review', task: 't-live', verdict: 'changes' },
      { at: T(5), by: 'lead', action: 'review', task: 't-live', verdict: 'changes' },
      { at: T(6), by: 'lead', action: 'reassign', task: 't-settings', from: 'dev-1', to: 'dev-3' },
      { at: T(7), by: 'dev-3', action: 'take', task: 't-other' }
    ];
    const found = twoTasks(log);

    expect(found.map(each => [each.title, each.evidence, each.live])).toEqual([
      ['dev-3 had two tasks in progress at once', ['t-other + t-settings, from 10:07 UTC'], true]
    ]);
    // Taking another while one is in hand is two at once.
    expect(
      twoTasks([
        { at: T(1), by: 'dev-1', action: 'take', task: 't-live' },
        { at: T(2), by: 'dev-1', action: 'take', task: 't-settings' }
      ]).map(each => each.evidence)
    ).toEqual([['t-live + t-settings, from 10:02 UTC']]);
    // Blocked, its agent took another; unblocked meanwhile, it waited for that one: never two at once.
    expect(
      twoTasks([
        { at: T(1), by: 'dev-1', action: 'take', task: 't-specs' },
        { at: T(2), by: 'dev-1', action: 'block', task: 't-specs' },
        { at: T(3), by: 'dev-1', action: 'take', task: 't-room' },
        { at: T(4), by: 'lead', action: 'unblock', task: 't-specs' },
        { at: T(5), by: 'dev-1', action: 'complete', task: 't-room' }
      ])
    ).toEqual([]);
  });

  it('says commands a session ran after it was told to stop — not a notice, nor a session started again', () => {
    const log: LogEntry[] = [{ at: T(10), by: 'dev-2', action: 'stops' }];
    const usage = [
      use(9, 'dev-2', 'plitzi task complete', { session: 'a' }),
      use(11, 'dev-2', 'plitzi run notice --plitzi x', { session: 'a' }),
      use(12, 'dev-2', 'plitzi task take t-skip', { session: 'a' }),
      use(13, 'dev-2', 'plitzi task next', { session: 'b' })
    ];

    expect(afterStop(log, usage).map(each => each.evidence)).toEqual([
      ['stopped at 10:10 UTC, then 1 command(s): plitzi task take t-skip…']
    ]);
    expect(afterStop([...log, { at: T(11), by: 'lead', action: 'launch', agent: 'dev-2' }], usage)).toEqual([]);
  });

  it('says one agent in two sessions at once (#44: started again while its last one still wrote)', () => {
    const usage = [
      use(1, 'dev-2', 'plitzi task next', { session: 'aaaaaaaa-1' }),
      use(2, 'dev-2', 'plitzi task next', { session: 'bbbbbbbb-2' }),
      use(3, 'dev-2', 'plitzi task complete', { session: 'aaaaaaaa-1' })
    ];

    expect(twoSessions(usage).map(each => each.title)).toEqual(['dev-2 ran in two sessions at once']);
    expect(twoSessions(usage.slice(0, 2))).toEqual([]);
  });
});

describe('what the checks say of themselves', () => {
  const check = (minute: number, failed: string[], more: LogEntry = {}): LogEntry => ({
    at: T(minute),
    by: 'dev-1',
    action: 'check',
    task: 't-gallery',
    ok: failed.length === 0,
    ...(failed.length > 0 ? { failed } : {}),
    ...more
  });

  it('says a check that answered two ways on one input — whose by what changed', () => {
    const line = 'acceptance — The room plays';
    const found = flakyChecks([
      check(1, [line], { input: 'k1' }),
      check(2, [], { input: 'k1' }),
      check(3, [line], { input: 'k2' })
    ]);

    expect(found.map(each => [each.owner, each.title])).toEqual([
      ['lead', "t-gallery's checks answered 2 ways on the same work: acceptance — The room plays"]
    ]);
    expect(flakyChecks([check(1, ['lint'], { input: 'k' }), check(2, [], { input: 'k' })])[0].owner).toBe('plitzi');
    expect(flakyChecks([check(1, [line]), check(2, [])])).toEqual([]);
  });

  it('says a line failing three checks of a task, never one nothing could answer (t-gallery-phone)', () => {
    const line = 'acceptance — On a phone a swipe moves the row';
    const failing = [
      check(1, [line], { input: 'a' }),
      check(2, [line], { input: 'b' }),
      check(3, [line], { input: 'b' })
    ];

    expect(linesFailing(failing).map(each => [each.title, each.evidence])).toEqual([
      [
        't-gallery: "On a phone a swipe moves the row" failed 3 checks',
        ['failed at 10:01 UTC, 10:02 UTC, 10:03 UTC', 'on 2 different version(s) of the work']
      ]
    ]);
    expect(linesFailing(failing.map(each => ({ ...each, notOwn: [line] })))).toEqual([]);
  });

  it('says a step run again rather than read, a regression of an approved task, and lines rewritten', () => {
    expect(stepsFailing([1, 2, 3, 4].map(minute => check(minute, ['author'])))[0]).toMatchObject({
      owner: 'agent',
      title: 't-gallery: author failed 4 checks'
    });
    expect(
      brokeApproved([
        {
          at: T(1),
          by: 'lead',
          action: 'refused',
          message: 'What "t-queue" was accepted on no longer holds on the run'
        }
      ])[0].times
    ).toBe(1);
    expect(
      linesAmended([
        {
          at: T(1),
          by: 'lead',
          action: 'amend',
          tasks: [
            { task: 't-a', changed: ['acceptance'] },
            { task: 't-b', changed: ['findings'] }
          ]
        }
      ])[0].evidence
    ).toEqual(['10:01 UTC t-a']);
  });
});

describe('what the agents looked for and did beside Plitzi', () => {
  it('says what explain had no answer for, and a topic one agent asked in several ways — not three agents once each', () => {
    const usage = [
      use(1, 'dev-1', 'plitzi explain dialogContainer', { code: 1 }),
      use(2, 'dev-1', 'plitzi explain openDialog'),
      use(3, 'dev-1', 'plitzi explain --search modal dialog close'),
      use(4, 'dev-1', 'plitzi explain formControl'),
      use(5, 'dev-2', 'plitzi explain formControl'),
      use(6, 'dev-3', 'plitzi explain formControl')
    ];
    const found = explainFindings(usage);

    expect(found.map(each => each.kind)).toEqual(['explain-missed', 'explain-topic']);
    expect(found[0].evidence).toEqual(['dev-1: dialogContainer']);
    expect(found[1].title).toBe('Topics explain did not answer the first time: “dialog”');
  });

  it('says the lead’s own scripts — not the project’s tests — and what agents wrote and installed in their scratch', () => {
    const tasks = [
      {
        id: 't-auth',
        acceptance: [
          { said: 'Signs up', check: 'node scratch/lead/checks/signup.mjs' },
          { said: 'Its tests', check: 'node --test src/functions/rooms.test.ts' }
        ]
      }
    ] as unknown as RunTask[]; // Only what the reading looks at: a task's id and its acceptance.
    const found = workaroundFindings(tasks, [
      { agent: 'design-1', scripts: ['axe/audit.mjs'], packages: ['axe-core'] },
      { agent: 'dev-1', scripts: [], packages: [] }
    ]);

    expect(found.map(each => [each.kind, each.evidence])).toEqual([
      ['own-script', ['t-auth: “Signs up” — node signup.mjs']],
      ['scratch-script', ['design-1: axe/audit.mjs']],
      ['scratch-package', ['design-1: axe-core']]
    ]);
  });

  it('groups what agents said of Plitzi, live once two agents said it (--follow, three agents)', () => {
    const said = (by: string, text: string, as: 'notice' | 'friction' = 'notice') => ({
      at: T(by.length),
      by,
      text,
      as
    });
    const found = saidFindings([
      said(
        'dev-1',
        "The prompt says 'task complete --follow --take', but task complete refuses unknown option --follow"
      ),
      // Said at its complete, not as a notice: one complaint all the same.
      said(
        'dev-22',
        "The launch prompt says 'task complete --follow --take' and task complete refuses --follow",
        'friction'
      ),
      said('dev-333', 'page measure reads no list-style nor ::marker')
    ]);

    expect(found.map(each => [each.kind, each.times, each.live ?? false])).toEqual([
      ['said', 2, true],
      ['said', 1, false]
    ]);
    expect(found[0].evidence).toEqual([
      'dev-1',
      "dev-22 (what got in its way): The launch prompt says 'task complete --follow --take' and task complete refuses --follow"
    ]);
  });
});

describe('what agents said, grouped by what it is about', () => {
  it('joins a text to a group by its first text, so a notice of two things draws no third in', () => {
    const groups = groupAlike(
      [
        "page play crashed once with undici 'setTypeOfService EINVAL' on the first run; a rerun worked",
        "page measure crashed once with 'setTypeOfService EINVAL' from undici. Also page measure with no --rows silently measures the first match of a repeated id",
        'page measure has no compact mode and measures only the first of a repeated element'
      ],
      text => text
    );

    expect(groups.map(group => group.length)).toEqual([2, 1]);
  });
});

describe('commands that failed, by why', () => {
  it('says a command refused as written — live when it happens again — the machine’s, and a CLI error met twice', () => {
    const usage = [
      use(1, 'dev-1', 'plitzi task complete --follow', { code: 1, error: "error: unknown option '--follow'" }),
      use(2, 'dev-2', 'plitzi task complete --follow', { code: 1, error: "error: unknown option '--follow'" }),
      use(3, 'dev-1', 'plitzi page shot /', { code: 1, error: 'connect ECONNREFUSED 127.0.0.1:8080' }),
      use(4, 'dev-1', 'plitzi server stop', { code: 1, error: 'Nothing listens on 8300' }),
      use(5, 'dev-2', 'plitzi server stop', { code: 1, error: 'Nothing listens on 8301' }),
      use(6, 'dev-2', 'plitzi task check', { code: 1, error: 'refused: lint fails' }),
      // explain's misses are its own finding's: a run said "explain active" there and here.
      use(7, 'dev-1', 'plitzi explain active', { code: 1, error: '"active" is no element' }),
      use(8, 'dev-1', 'plitzi explain icon', { code: 1, error: '"icon" is no element' })
    ];

    expect(errorFindings(usage).map(each => [each.kind, each.owner, each.times, each.live ?? false])).toEqual([
      ['refused-as-written', 'plitzi', 2, true],
      ['machine-error', 'machine', 1, false],
      ['command-errors', 'plitzi', 2, false]
    ]);
  });
});

describe('what the run spent that it did not have to', () => {
  const spent = (processed: number, contextAtEnd = 40_000): NonNullable<TaskRoundReport['harness']> => ({
    harness: 'claude',
    turns: 50,
    input: 0,
    cacheRead: processed,
    cacheWrite: 0,
    output: 0,
    processed,
    contextAtEnd,
    heaviest: [{ tool: 'Bash', what: 'plitzi page measure', results: 3, chars: 60_000, reread: 1_200_000 }],
    plitziRead: []
  });
  const round = (task: string, harness: TaskRoundReport['harness']): TaskRoundReport => ({
    version: 1,
    task,
    round: 1,
    agent: 'dev-1',
    from: T(0),
    to: T(10),
    minutes: 10,
    sessions: [],
    checks: { run: 0, failed: 0, notOwn: 0, byStep: {}, why: [] },
    refusals: [],
    commands: { run: 0, failed: 0, chars: 0, seconds: 0, byName: {} },
    errors: [],
    explain: { asked: [], missed: [] },
    notices: [],
    harness
  });

  it('says a long answer, a task far over the median, a heavy context and the results read again the most', () => {
    const found = costFindings(
      [use(1, 'dev-1', 'plitzi task show t-a', { chars: 64_000 })],
      [
        { by: 'dev-2', command: 'plitzi task check', times: 4, within: 6 },
        { by: 'lead', command: 'plitzi task show t-a', times: 5, within: 7 },
        { by: 'lead', command: 'plitzi task show t-b', times: 3, within: 2 }
      ],
      [
        round('t-a', spent(1_000_000)),
        round('t-b', spent(1_000_000)),
        round('t-c', spent(1_000_000)),
        round('t-d', spent(9_000_000, 210_000)),
        round('t-e', spent(1_000_000, 160_000))
      ]
    );

    expect(found.map(each => [each.kind, each.owner])).toEqual([
      ['large-output', 'plitzi'],
      ['repeated-call', 'plitzi'],
      ['repeated-call', 'plitzi'],
      ['costly-task', 'agent'],
      ['context-heavy', 'lead'],
      ['costly-result', 'plitzi']
    ]);
    // One a command, its bursts the evidence: a run's nine "lead ran task show" were nine findings.
    expect(found[1].title).toBe('dev-2 ran task check 4 times in 6 min');
    expect(found[2]).toMatchObject({
      title: 'task show was run again and again: 2 bursts by lead, up to 5 times in 7 min',
      times: 8
    });
    expect(found[5].title).toBe('What Bash plitzi page measure answered was read again for 6M tokens');
    // One finding a kind, the rounds its evidence: a run said eleven heavy contexts as eleven.
    expect(found[4]).toMatchObject({
      title: '2 rounds ended with over 150k tokens of context',
      evidence: ['dev-1 at t-d (round 1): 210k, 50 turns, 9M read', 'dev-1 at t-e (round 1): 160k, 50 turns, 1M read'],
      times: 2
    });
    expect(found[3].title).toBe('t-d read over 2.5× the run’s median task (1M)');
  });
});

describe('the findings, together', () => {
  it('are ordered by whose, and counted as the bench’s indicators', () => {
    const log: LogEntry[] = [
      { at: T(1), by: 'dev-1', action: 'take', task: 't-a' },
      { at: T(2), by: 'dev-1', action: 'take', task: 't-b' }
    ];
    const usage = [use(3, 'dev-1', 'plitzi explain authSignup', { code: 1 })];
    const findings = runFindings({ log, usage, tasks: [], said: [], scratch: [], taskReports: [], repeated: [] });

    expect(findings.map(each => each.kind)).toEqual(['two-tasks', 'explain-missed']);
    expect(liveFindings({ log, usage, said: [] }).map(each => each.kind)).toEqual(['two-tasks']);
    expect(indicatorsOf(findings, { checks: { run: 4, failed: 2, notOwn: 2, byStep: {} } }, [], 2)).toEqual({
      findings: { plitzi: 2, lead: 0, agent: 0, machine: 0 },
      notOwnPct: 50,
      flakyChecks: 0,
      linesFailing: 0,
      sessionBreaks: 1,
      explainMissed: 1,
      workarounds: 0,
      saidByMany: 0,
      refusedAsWritten: 0
    });
  });
});
