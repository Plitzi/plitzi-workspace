import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDeadline } from './deadline';

describe('a run’s time limit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ends the run past its time, and aborts what it runs', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const deadline = createDeadline(100, controller);
    const ended = deadline.promise.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(101);
    expect(String(await ended)).toContain('Action exceeded its 100ms budget');
    expect(controller.signal.aborted).toBe(true);
  });

  // A runner's queue, a turn at its CPU: the platform's capacity, never the run's time to have spent.
  it('moves by what the run waited for the platform’s capacity', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const deadline = createDeadline(100, controller);
    let ended = false;
    deadline.promise.catch(() => {
      ended = true;
    });

    await vi.advanceTimersByTimeAsync(60);
    deadline.extend(250);
    await vi.advanceTimersByTimeAsync(200);
    expect([ended, controller.signal.aborted]).toEqual([false, false]);

    await vi.advanceTimersByTimeAsync(100);
    expect(ended).toBe(true);
    deadline.clear();
  });
});
