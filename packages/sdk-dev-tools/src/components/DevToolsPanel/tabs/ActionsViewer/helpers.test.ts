import { describe, expect, it } from 'vitest';

import { failedStep, filterRuns, formatMs, matchesQuery, stepBars, stepCount, traceResultOf } from './helpers';

import type { ActionRunEntry, ActionRunStep } from '@plitzi/sdk-shared';

const step = (id: string, overrides: Partial<ActionRunStep> = {}): ActionRunStep => ({
  id,
  title: id,
  action: 'kv.increment',
  status: 'success',
  phase: 'flow',
  startTime: 1_000,
  endTime: 1_010,
  ...overrides
});

const run = (overrides: Partial<ActionRunEntry> = {}): ActionRunEntry => ({
  id: 'run-1',
  actionId: 'booking',
  mode: 'await',
  status: 'completed',
  progress: [],
  startedAt: 1_000,
  endedAt: 1_050,
  ...overrides
});

describe('filterRuns', () => {
  it('keeps only what is still happening when asked for live runs', () => {
    const live = run({ id: 'run-2', status: 'running', endedAt: undefined });

    expect(filterRuns([run(), live], 'live', '').map(entry => entry.id)).toEqual(['run-2']);
  });

  /** A run the server refused and one the visitor left are both failures to whoever is looking for one. */
  it('counts an aborted run as failed', () => {
    const aborted = run({ id: 'run-3', status: 'aborted' });

    expect(filterRuns([run(), aborted], 'failed', '').map(entry => entry.id)).toEqual(['run-3']);
  });

  it('searches the steps, not only the run', () => {
    const mailing = run({ steps: [step('mail', { title: 'Send confirmation', action: 'email.send' })] });

    expect(filterRuns([run(), mailing], 'all', 'email.send')).toHaveLength(1);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(run(), '   ')).toBe(true);
  });
});

describe('stepBars', () => {
  /** The property the timeline is read for: which step took the run. */
  it('places each step on the run’s own span', () => {
    const bars = stepBars([step('take', { startTime: 0, endTime: 10 }), step('mail', { startTime: 10, endTime: 100 })]);

    expect(bars[0].offset).toBe(0);
    expect(bars[0].width).toBeCloseTo(0.1);
    expect(bars[1].offset).toBeCloseTo(0.1);
    expect(bars[1].width).toBeCloseTo(0.9);
  });

  /** A step that ran and a step that did not must never look alike, however fast the flow was. */
  it('gives an instant step a sliver rather than nothing', () => {
    const bars = stepBars([step('take', { startTime: 0, endTime: 0 }), step('out', { startTime: 0, endTime: 50 })]);

    expect(bars[0].width).toBeGreaterThan(0);
  });

  it('fills the bar for a run whose steps all took no measurable time', () => {
    const bars = stepBars([step('take', { startTime: 5, endTime: 5 })]);

    expect(bars[0]).toMatchObject({ offset: 0, width: 1 });
  });

  it('has nothing to place for a run with no steps', () => {
    expect(stepBars([])).toEqual([]);
  });
});

describe('failedStep', () => {
  it('names the step that broke the flow', () => {
    const steps = [step('take'), step('mail', { status: 'failed', error: 'no credential' }), step('undo')];

    expect(failedStep(steps)?.id).toBe('mail');
  });

  it('answers nothing for a run that did not fail, and for one that sent no steps', () => {
    expect(failedStep([step('take')])).toBeUndefined();
    expect(failedStep(undefined)).toBeUndefined();
  });
});

describe('traceResultOf', () => {
  it('reads back what a step answered, when the trace was sent', () => {
    const trace = [{ node: { id: 'take' }, result: { seats: 2 } }];

    expect(traceResultOf(trace, 'take')).toEqual({ seats: 2 });
  });

  /** The ordinary case: a visitor's answer carries the outline and no results at all. */
  it('answers nothing when no trace came with the run', () => {
    expect(traceResultOf(undefined, 'take')).toBeUndefined();
  });
});

describe('stepCount', () => {
  /** A flow of one step is common — a single `flow.output` — and "1 steps" is the panel looking unfinished. */
  it('counts one step as a step', () => {
    expect(stepCount(1)).toBe('1 step');
    expect(stepCount(2)).toBe('2 steps');
  });
});

describe('formatMs', () => {
  it('reads a short run in milliseconds and a long one in seconds', () => {
    expect(formatMs(42)).toBe('42ms');
    expect(formatMs(1_500)).toBe('1.50s');
  });
});
