import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import delayTime from './delayTime';

import type { InteractionCallbackContext } from '@plitzi/sdk-shared';

// Declared optional on every interaction callback; delayTime always has one.
const wait = delayTime.callback as (params: { time: number }, context?: InteractionCallbackContext) => Promise<unknown>;

describe('delayTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits the milliseconds it is given', async () => {
    let done = false;
    void wait({ time: 450 }).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(449);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(done).toBe(true);
  });

  it('stops waiting the moment its flow is superseded', async () => {
    const controller = new AbortController();
    let done = false;
    void wait({ time: 60_000 }, { signal: controller.signal }).then(() => {
      done = true;
    });

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not wait at all for a flow already superseded', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(wait({ time: 60_000 }, { signal: controller.signal })).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
