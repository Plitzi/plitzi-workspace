import { afterEach, describe, expect, it, vi } from 'vitest';

import { flowTasks } from './flow';

import type { ActionTaskContext } from '../types';

const delay = flowTasks.find(task => task.action === 'delay');

describe('flow.delay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A bound value past the cap: capped, and said on the step — it waited less than it was asked, never silently.
  it('waits at most its cap, and says so on its log when asked for more', async () => {
    vi.useFakeTimers();
    const lines: string[] = [];
    // Only what the step reads of a run: its log and its signal.
    const ctx = {
      log: (line: string) => lines.push(line),
      signal: new AbortController().signal
    } as unknown as ActionTaskContext;
    const waited = delay?.run({ milliseconds: '15000' }, ctx);
    await vi.advanceTimersByTimeAsync(5000);

    expect(await waited).toEqual({ waited: 5000 });
    expect(lines).toEqual(['Asked to wait 15000 ms; a step waits at most 5000 ms, and waited that']);
  });

  it('says nothing of a wait within it', async () => {
    vi.useFakeTimers();
    const lines: string[] = [];
    // Only what the step reads of a run: its log and its signal.
    const ctx = {
      log: (line: string) => lines.push(line),
      signal: new AbortController().signal
    } as unknown as ActionTaskContext;
    const waited = delay?.run({ milliseconds: 1200 }, ctx);
    await vi.advanceTimersByTimeAsync(1200);

    expect(await waited).toEqual({ waited: 1200 });
    expect(lines).toEqual([]);
  });
});
