import { describe, expect, it } from 'vitest';

import { commandName, runMetrics } from './runMetrics';

import type { UsageLine } from './usage';

const T = (minutes: number): string => new Date(Date.UTC(2026, 9, 21, 23, 0) + minutes * 60_000).toISOString();

// velada-polish's t-match-bars, its times as the lead read them off the log by hand to find where the run went.
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
  { at: T(16), by: 'dev-1', action: 'complete', task: 't-bars', review: 'ui' },
  { at: T(18), by: 'design-2', action: 'review-taken', task: 't-bars', review: 'ui' },
  { at: T(21), by: 'design-2', action: 'design-review', task: 't-bars', verdict: 'changes', round: 1 },
  { at: T(31), by: 'dev-1', action: 'check', task: 't-bars', ok: true },
  { at: T(33), by: 'dev-1', action: 'complete', task: 't-bars', review: 'ui' },
  { at: T(34), by: 'design-2', action: 'review-taken', task: 't-bars', review: 'ui' },
  { at: T(36), by: 'design-2', action: 'design-review', task: 't-bars', verdict: 'approve' },
  { at: T(37), by: 'lead', action: 'review', task: 't-bars', verdict: 'approve' },
  { at: T(37), by: 'lead', action: 'all-approved' },
  { at: T(20), by: 'dev-2', action: 'refused', code: 'lead-only', command: 'plitzi task show t-bars' },
  { at: T(25), by: 'design-2', action: 'refused', code: 'identity', command: 'plitzi task look t-bars' }
].sort((a, b) => a.at.localeCompare(b.at));

const usage: UsageLine[] = [
  ...[13, 13.2, 13.4].map(minute => ({
    at: T(minute),
    by: 'dev-1',
    command: 'plitzi task check',
    chars: 4000,
    ms: 9000,
    code: 1
  })),
  { at: T(18), by: 'design-2', command: 'plitzi task look t-bars --before', chars: 12_000, ms: 90_000, code: 0 }
];

describe('a run measured from its records', () => {
  const metrics = runMetrics({
    log,
    usage,
    answers: [{ replyTo: 'm1', at: T(15.5) }],
    tokens: { 'dev-1': 208_061 },
    taskIds: ['t-bars'],
    openedAt: T(0),
    now: T(60)
  });

  it('says where a task’s time went: to take, at work, waiting for each review and for its agent sent back', () => {
    expect(metrics.tasks[0]).toMatchObject({
      task: 't-bars',
      agents: ['dev-1'],
      toTake: 2,
      worked: 6,
      rounds: { ui: 1, lead: 0 },
      uiWaits: [2, 1],
      uiReviews: [3, 2],
      leadWaits: [1],
      reworkWaits: [10],
      checks: { run: 5, failed: 2 }
    });
    expect(metrics).toMatchObject({ workMinutes: 37, afterMinutes: 23 });
  });

  it('says each agent’s part — its waits, reviews, refusals and what the CLI made it read', () => {
    expect(metrics.agents.find(agent => agent.agent === 'design-2')).toMatchObject({
      waited: 8,
      refused: 1,
      reviews: { ui: 2, uiChanges: 1, medianMinutes: 2 },
      calls: 1,
      readTokens: 3000
    });
    expect(metrics.agents.find(agent => agent.agent === 'dev-1')).toMatchObject({ tokens: 208_061, completes: 2 });
  });

  it('counts failed checks by step, refusals by code, a question’s wait, and calls made again and again', () => {
    expect(metrics.checks).toEqual({
      run: 5,
      failed: 2,
      notOwn: 1,
      byStep: { typecheck: 1, lint: 1, acceptance: 1 }
    });
    expect(metrics.refusals.byCode).toMatchObject({
      'lead-only': { times: 1, by: ['dev-2'], command: 'plitzi task show t-bars' },
      identity: { times: 1, by: ['design-2'] }
    });
    expect(metrics.questions).toEqual({ asked: 1, answered: 1, waits: [0.5] });
    expect(metrics.cost.repeated).toEqual([{ by: 'dev-1', command: 'plitzi task check', times: 3, within: 0.4 }]);
    expect(metrics.cost).toMatchObject({ calls: 4, readTokens: 6000, tokens: 208_061 });
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

  it('names a command by what it is, not what it is about', () => {
    expect(commandName('plitzi task look t-bars --before')).toBe('task look');
    expect(commandName('plitzi page shot / --width 390')).toBe('page shot');
  });
});
