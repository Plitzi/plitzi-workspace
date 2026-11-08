import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCpuMeter, isolatesCpuMs } from './cpuMeter';

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
    const meter = createCpuMeter(5, 64, readProcess);
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
    const meter = createCpuMeter(5, 64, readProcess);
    const metered = [0, 1, 2, 3].map(index => meter.meter(readIsolate(index)));

    state.process += 10;
    state.isolates = [10, 10, 10, 10];
    await vi.advanceTimersByTimeAsync(5);

    metered.forEach(each => expect(each.charged()).toBe(2.5));
  });

  it('charges a spinner beside a light one its share, and the light one only its own', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, 64, readProcess);
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
    const meter = createCpuMeter(5, 64, readProcess);
    const one = meter.meter(readIsolate(0));

    state.process += 3;
    state.isolates[0] = 3;
    one.end();
    state.process += 50;
    state.isolates[0] = 50;
    await vi.advanceTimersByTimeAsync(20);

    expect(one.charged()).toBe(3);
  });

  /**
   * The other bound: V8's collector and the runner's helper threads take CPU no isolate is measured at, and on the
   * threads' count alone a light route measured inflated beside it was charged it all, and stopped at its limit. One core
   * for 5 ms holds 5 ms of all of them: four measured 5 each, beside 20 the threads took, had 1.25 each.
   */
  it('charges no more than the machine’s cores held for the look, whatever else the threads took', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, 1, readProcess);
    const metered = [0, 1, 2, 3].map(index => meter.meter(readIsolate(index)));

    state.process += 20;
    state.isolates = [5, 5, 5, 5];
    await vi.advanceTimersByTimeAsync(5);

    metered.forEach(each => expect(each.charged()).toBe(1.25));
  });

  // Shared in proportion to what each ran: one that barely ran beside a spinner takes nothing from what it is charged.
  it('shares the cores’ bound in proportion to what each ran', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readIsolate } = clocks();
    const meter = createCpuMeter(5, 1, readProcess);
    const spinner = meter.meter(readIsolate(0));
    const idle = meter.meter(readIsolate(1));

    state.process += 5;
    state.isolates = [5, 0.1, 0, 0];
    await vi.advanceTimersByTimeAsync(5);

    expect(spinner.charged()).toBeCloseTo(4.9, 1);
    expect(idle.charged()).toBeCloseTo(0.1, 1);
  });

  // The regression it guards: the main thread's work — making isolates, compiling bundles — counted as theirs, and a
  // running isolate was charged what V8 measured while it was busy. The main thread spinning moves none of it.
  it('reads the isolates’ threads alone, never the main thread’s work', () => {
    const before = isolatesCpuMs();
    const until = Date.now() + 100;
    let n = 0;
    while (Date.now() < until) {
      n += Math.sqrt(n + 1);
    }

    expect(n).toBeGreaterThan(0);
    expect(isolatesCpuMs() - before).toBeLessThan(30);
  });
});
