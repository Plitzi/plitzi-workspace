import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TURN_SLICE_MS, createTurns } from './turns';

describe('turns at running JavaScript', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands out as many as it has at once, the next one as one is given back', async () => {
    const turns = createTurns(1);
    const first = await turns.take();
    let second: number | undefined;
    void turns.take().then(id => {
      second = id;
    });
    await vi.advanceTimersByTimeAsync(TURN_SLICE_MS / 2);
    expect(second).toBeUndefined();

    turns.give(first);
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toBeDefined();
  });

  // A runner of 2 vCPU: two isolates run JavaScript truly at once, the third waits for one of them.
  it('hands out two at once on a runner of two cores, and a third as one is given back', async () => {
    const turns = createTurns(2);
    const first = await turns.take();
    const second = await turns.take();
    let third: number | undefined;
    void turns.take().then(id => {
      third = id;
    });
    await vi.advanceTimersByTimeAsync(TURN_SLICE_MS / 2);
    expect(second).not.toBe(first);
    expect(third).toBeUndefined();

    turns.give(second);
    await vi.advanceTimersByTimeAsync(0);
    expect(third).toBeDefined();
  });

  // A run long on the CPU shares it with the next, as a scheduler would, rather than holding every other isolate up.
  it('lets the next one in beside a turn held past its slice', async () => {
    const turns = createTurns(1);
    await turns.take();
    let next: number | undefined;
    void turns.take().then(id => {
      next = id;
    });

    await vi.advanceTimersByTimeAsync(TURN_SLICE_MS + TURN_SLICE_MS / 2);
    expect(next).toBeDefined();
  });

  it('hands them out in the order they were asked for', async () => {
    const turns = createTurns(1);
    const held = await turns.take();
    const order: string[] = [];
    void turns.take().then(id => {
      order.push('a');
      turns.give(id);
    });
    void turns.take().then(() => order.push('b'));

    turns.give(held);
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['a', 'b']);
  });
});
