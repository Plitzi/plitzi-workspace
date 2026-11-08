import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCpuMeter } from './cpuMeter';

/** A clock in hand: what the process took and what each isolate was measured at, moved by the test. */
const clocks = () => {
  const state = { process: 0, isolates: [0, 0, 0, 0] };

  return { state, readProcess: () => state.process, readIsolate: (index: number) => () => state.isolates[index] ?? 0 };
};

describe('the CPU meter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('charges an isolate what it was measured at while it had the CPU to itself', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, readProcess);
    const one = meter.meter(readIsolate(0));

    state.process += 10;
    state.isolates[0] = 10;
    await vi.advanceTimersByTimeAsync(5);

    expect(one.charged()).toBe(10);
  });

  // Four measured 10 ms each in a slice the process took 10 ms of: each ran a quarter of it, and waited the rest.
  it('shares out what the process took when the isolates were measured at more, as each ran', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, readProcess);
    const metered = [0, 1, 2, 3].map(index => meter.meter(readIsolate(index)));

    state.process += 10;
    state.isolates = [10, 10, 10, 10];
    await vi.advanceTimersByTimeAsync(5);

    metered.forEach(each => expect(each.charged()).toBe(2.5));
  });

  it('charges a spinner beside a light one its share, and the light one only its own', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, readProcess);
    const spinner = meter.meter(readIsolate(0));
    const light = meter.meter(readIsolate(1));

    // The process took 10 ms; the spinner was measured 15 and the light one 5 — 20 in all, so each is halved.
    state.process += 10;
    state.isolates = [15, 5, 0, 0];
    await vi.advanceTimersByTimeAsync(5);

    expect(spinner.charged()).toBe(7.5);
    expect(light.charged()).toBe(2.5);
  });

  it('charges its last slice as it ends, and looks at it no more', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, readProcess);
    const one = meter.meter(readIsolate(0));

    state.process += 3;
    state.isolates[0] = 3;
    one.end();
    state.process += 50;
    state.isolates[0] = 50;
    await vi.advanceTimersByTimeAsync(20);

    expect(one.charged()).toBe(3);
  });
});
