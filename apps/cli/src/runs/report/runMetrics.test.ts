import { describe, expect, it } from 'vitest';

import { harnessOf, runMetrics } from './runMetrics';
import { ranAs } from '../../tests/ranAs';

import type { UsageLine } from '../core/usage';

const T = (minutes: number): string => new Date(Date.UTC(2026, 9, 21, 23, 0) + minutes * 60_000).toISOString();

// A run's t-match-bars, its times as the lead read them off the log by hand to find where the run went.
const log: Record<string, unknown>[] = [
  { at: T(0), by: 'lead', action: 'open', taskIds: ['s-scope'] },
  { at: T(10), by: 'lead', action: 'extend', added: ['t-bars'] },
  { at: T(10), by: 'dev-1', action: 'joined' },
  { at: T(10), by: 'design-2', action: 'waiting', why: 'nothing is ready' },
  { at: T(12), by: 'dev-1', action: 'take', task: 't-bars' },
  { at: T(13), by: 'dev-1', action: 'check', task: 't-bars', ok: false, failed: ['typecheck'] },
  { at: T(14), by: 'dev-1', action: 'check', task: 't-bars', ok: false, failed: ['lint', 'acceptance — the bar'] },
  // Failed for nothing of its own — the run's work fails author too, and the logo's line read nothing: not counted.
  {
    at: T(14.5),
    by: 'dev-1',
    action: 'check',
    task: 't-bars',
    ok: false,
    failed: ['author', 'acceptance — the logo'],
    notOwn: ['author', 'acceptance — the logo']
  },
  { at: T(15), by: 'dev-1', action: 'check', task: 't-bars', ok: true },
  { at: T(15), by: 'dev-1', action: 'ask', task: 't-bars', message: 'm1' },
  // Its review: a designer's step, then the lead's.
  { at: T(16), by: 'dev-1', action: 'complete', task: 't-bars', review: ['designer', 'lead'] },
  { at: T(18), by: 'design-2', action: 'review-taken', task: 't-bars', review: 'designer' },
  { at: T(21), by: 'design-2', action: 'review', task: 't-bars', verdict: 'changes', round: 1, step: 'designer' },
  { at: T(31), by: 'dev-1', action: 'check', task: 't-bars', ok: true },
  { at: T(33), by: 'dev-1', action: 'complete', task: 't-bars', review: ['designer', 'lead'] },
  { at: T(34), by: 'design-2', action: 'review-taken', task: 't-bars', review: 'designer' },
  { at: T(36), by: 'design-2', action: 'review', task: 't-bars', verdict: 'approve', round: 1, step: 'designer' },
  // The lead says its step untaken: its wait runs from the designer's approval to its word.
  { at: T(37), by: 'lead', action: 'review', task: 't-bars', verdict: 'approve', merged: [], step: 'lead' },
  { at: T(37), by: 'lead', action: 'all-approved' },
  // Past the last approval: what it waits for now is the person's finish, not work.
  { at: T(40), by: 'test-1', action: 'waiting', why: 'every task is done' },
  {
    at: T(20),
    by: 'dev-2',
    action: 'refused',
    code: 'lead-only',
    command: 'plitzi task show t-bars',
    name: 'task show'
  },
  {
    at: T(25),
    by: 'design-2',
    action: 'refused',
    code: 'identity',
    command: 'plitzi task look t-bars',
    name: 'task look'
  }
].sort((a, b) => a.at.localeCompare(b.at));

const usage: UsageLine[] = [
  ...[13, 13.2, 13.4].map(minute => ({
    at: T(minute),
    by: 'dev-1',
    command: 'plitzi task check',
    ...ranAs('plitzi task check'),
    chars: 4000,
    ms: 9000,
    code: 1
  })),
  {
    at: T(18),
    by: 'design-2',
    command: 'plitzi task look t-bars --before',
    ...ranAs('plitzi task look t-bars --before'),
    chars: 12_000,
    ms: 90_000,
    code: 0
  }
];

describe('a run measured from its records', () => {
  const metrics = runMetrics({
    log,
    usage,
    answers: [{ replyTo: 'm1', at: T(15.5) }],
    harness: { 'dev-1': { processed: 2_000_000, contextMax: 208_061, reread: 900_000 } },
    taskIds: ['t-bars'],
    openedAt: T(0),
    now: T(60)
  });

  it('says where a task’s time went: to take, at work, each step of its review and its agent sent back', () => {
    expect(metrics.tasks[0]).toMatchObject({
      task: 't-bars',
      agents: ['dev-1'],
      toTake: 2,
      worked: 6,
      rounds: { designer: 1 },
      steps: [
        { step: 'designer', waited: 2, said: 3 },
        { step: 'designer', waited: 1, said: 2 },
        { step: 'lead', waited: 1 }
      ],
      reworkWaits: [10],
      checks: { run: 5, failed: 2 }
    });
    expect(metrics).toMatchObject({ workMinutes: 37, afterMinutes: 23 });
  });

  it('says each agent’s part — its waits, reviews, refusals and what the CLI made it read', () => {
    expect(metrics.agents.find(agent => agent.agent === 'design-2')).toMatchObject({
      waited: 8,
      refused: 1,
      reviews: { byStep: { designer: { said: 2, changes: 1 } }, medianMinutes: 2 },
      calls: 1,
      readTokens: 3000
    });
    expect(metrics.agents.find(agent => agent.agent === 'test-1')?.waited).toBe(0);
    const dev = metrics.agents.find(agent => agent.agent === 'dev-1');
    expect(dev).toMatchObject({
      harness: { processed: 2_000_000, contextMax: 208_061, reread: 900_000 },
      completes: 2
    });
  });

  it('counts failed checks by step, refusals by code, a question’s wait, and calls made again and again', () => {
    expect(metrics.checks).toEqual({
      run: 5,
      failed: 2,
      notOwn: 1,
      byStep: { typecheck: 1, lint: 1, acceptance: 1 }
    });
    expect(metrics.refusals.byCode).toMatchObject({
      'lead-only': { times: 1, by: ['dev-2'], name: 'task show' },
      identity: { times: 1, by: ['design-2'] }
    });
    expect(metrics.questions).toEqual({ asked: 1, answered: 1, waits: [0.5] });
    expect(metrics.cost.repeated).toEqual([
      { by: 'dev-1', name: 'task check', command: 'plitzi task check', times: 3, within: 0.4 }
    ]);
    expect(metrics.cost).toMatchObject({
      calls: 4,
      readTokens: 6000,
      harness: { processed: 2_000_000, reread: 900_000 }
    });
    expect(metrics.cost.byCommand.find(each => each.command === 'task check')).toEqual({
      command: 'task check',
      calls: 3,
      readTokens: 3000,
      seconds: 27,
      medianSeconds: 9
    });
  });

  // Carlos: every second an agent spends inside the CLI is multiplied by agents and calls — measured, against a budget.
  it('says the time spent inside the CLI by command, the slowest first, and a median past its budget', () => {
    expect(metrics.cost.byCommand[0]).toMatchObject({ command: 'task look', seconds: 90, overBudget: 60 });
    expect(metrics.cost.cliMinutes).toBe(2);
  });
});

describe('a call made again', () => {
  const measured = (lines: UsageLine[]) =>
    runMetrics({ log: [], usage: lines, answers: [], harness: {}, taskIds: [], openedAt: T(0), now: T(60) }).cost
      .repeated;
  const line = (minute: number, command: string, session?: string): UsageLine => ({
    at: T(minute),
    by: 'test-1',
    command,
    ...ranAs(command),
    chars: 400,
    ms: 500,
    code: 0,
    ...(session === undefined ? {} : { session })
  });

  it('is no loop when the call is how work is waited for or taken (a fresh session each)', () => {
    expect(
      measured([
        ...[1, 2, 3, 4].map(minute => line(minute, 'plitzi task next --role tester --follow --take')),
        ...[5, 6, 7].map(minute => line(minute, 'plitzi task next --role lead --take')),
        ...[8, 9, 10].map(minute => line(minute, 'plitzi run watch --until lead')),
        // A dry run, tried after each edit of what it checks: a run's scout and its stage.
        ...[11, 11.1, 11.2].map(minute => line(minute, 'plitzi run extend stage.json --dry-run'))
      ])
    ).toEqual([]);
  });

  it('counts in one session, not across fresh ones', () => {
    expect(measured([1, 2, 3].map(minute => line(minute, 'plitzi task context', `s${String(minute)}`)))).toEqual([]);
    expect(measured([1, 2, 3].map(minute => line(minute, 'plitzi task context', 's1')))).toEqual([
      { by: 'test-1', name: 'task context', command: 'plitzi task context', times: 3, within: 2 }
    ]);
  });
});

describe('each agent’s harness over the run', () => {
  it('sums its rounds, keeps its largest context, and counts what its heaviest results were read again for', () => {
    const round = (agent: string, processed: number, contextAtEnd: number, reread: number[]) => ({
      agent,
      harness: { processed, contextAtEnd, heaviest: reread.map(each => ({ reread: each })) }
    });

    expect(
      harnessOf([
        round('design-1', 5_000_000, 168_000, [1_000, 2_000]),
        round('design-1', 7_000_000, 193_000, [500]),
        { agent: 'dev-1' }
      ])
    ).toEqual({ 'design-1': { processed: 12_000_000, contextMax: 193_000, reread: 3_500 } });
  });
});

// Its scope's rework read 5.4 min waited, its scout at it again 10 s after the changes (a card handed back in
// the same context takes nothing); its tests cards read 10–12 min to take, each waiting for the task it tests.
describe('a card handed back, and one that waited for another', () => {
  const handed: Record<string, unknown>[] = [
    { at: T(0), by: 'lead', action: 'open', taskIds: ['s-scope'] },
    { at: T(1), by: 'scout-1', action: 'take', task: 's-scope' },
    { at: T(10), by: 'scout-1', action: 'complete', task: 's-scope' },
    { at: T(11), by: 'lead', action: 'review', task: 's-scope', verdict: 'changes', round: 1, step: 'lead' },
    { at: T(11.5), by: 'scout-1', action: 'brief', task: 's-scope' },
    { at: T(16), by: 'scout-1', action: 'complete', task: 's-scope' },
    { at: T(20), by: 'lead', action: 'extend', added: ['t-home', 't-home-tests'] },
    { at: T(21), by: 'dev-1', action: 'take', task: 't-home' },
    { at: T(30), by: 'test-1', action: 'handed-on', task: 't-home', ready: ['t-home-tests'] },
    { at: T(31), by: 'dev-2', action: 'take', task: 't-home-tests' }
  ];
  const metrics = runMetrics({
    log: handed,
    usage: [],
    answers: [],
    harness: {},
    taskIds: ['s-scope', 't-home-tests'],
    openedAt: T(0),
    now: T(40)
  });

  it('is at it again when its agent reads its brief, and taken from when it could be', () => {
    expect(metrics.tasks.find(task => task.task === 's-scope')?.reworkWaits).toEqual([0.5]);
    expect(metrics.tasks.find(task => task.task === 't-home-tests')?.toTake).toBe(1);
  });
});
