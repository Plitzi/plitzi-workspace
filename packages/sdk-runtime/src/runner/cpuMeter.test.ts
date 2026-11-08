import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCpuMeter, isolatesCpuMs } from './cpuMeter';

/** A clock in hand: what the isolates' threads and the main one took, and what each isolate was measured at. */
const clocks = () => {
  const state = { process: 0, main: 0, isolates: [0, 0, 0, 0] };

  return {
    state,
    readProcess: () => state.process,
    readMain: () => state.main,
    readIsolate: (index: number) => () => state.isolates[index] ?? 0
  };
};

describe('the CPU meter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('charges an isolate what it was measured at while it had the CPU to itself', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 64, readProcess, readMain);
    const one = meter.meter(readIsolate(0));

    state.process += 10;
    state.isolates[0] = 10;
    await vi.advanceTimersByTimeAsync(5);

    expect(one.charged()).toBe(10);
  });

  // Four measured 10 ms each in a slice the process took 10 ms of: each ran a quarter of it, and waited the rest.
  it('shares out what the process took when the isolates were measured at more, as each ran', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 64, readProcess, readMain);
    const metered = [0, 1, 2, 3].map(index => meter.meter(readIsolate(index)));

    state.process += 10;
    state.isolates = [10, 10, 10, 10];
    await vi.advanceTimersByTimeAsync(5);

    metered.forEach(each => expect(each.charged()).toBe(2.5));
  });

  it('charges a spinner beside a light one its share, and the light one only its own', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 64, readProcess, readMain);
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
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 64, readProcess, readMain);
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
  it('charges no more than the cores held for the look, whatever else the threads took', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 1, readProcess, readMain);
    const metered = [0, 1, 2, 3].map(index => meter.meter(readIsolate(index)));

    state.process += 20;
    state.isolates = [5, 5, 5, 5];
    await vi.advanceTimersByTimeAsync(5);

    metered.forEach(each => expect(each.charged()).toBe(1.25));
  });

  /**
   * The regression it guards: under load the main thread — a thousand sockets — took the core from the isolate whose turn
   * it was, and V8 measured that isolate as if it ran. On the machine's cores, a 5 ms route was charged past its 100 ms
   * limit and stopped. What the main thread took of the quota's core was no isolate's: of 5 ms, it took 3.
   */
  it('charges no more than the cores held less what the main thread took of them', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 1, readProcess, readMain);
    const one = meter.meter(readIsolate(0));

    state.main += 3;
    // The threads' count holds work no isolate is measured at too (a bundle compiled, the collector): 5 in all.
    state.process += 5;
    state.isolates[0] = 5;
    await vi.advanceTimersByTimeAsync(5);

    expect(one.charged()).toBe(2);
  });

  // Shared in proportion to what each ran: one that barely ran beside a spinner takes nothing from what it is charged.
  it('shares the cores’ bound in proportion to what each ran', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 1, readProcess, readMain);
    const spinner = meter.meter(readIsolate(0));
    const idle = meter.meter(readIsolate(1));

    state.process += 5;
    state.isolates = [5, 0.1, 0, 0];
    await vi.advanceTimersByTimeAsync(5);

    expect(spinner.charged()).toBeCloseTo(4.9, 1);
    expect(idle.charged()).toBeCloseTo(0.1, 1);
  });

  /**
   * The regression the window guards: the system counts a thread's CPU in scheduler ticks, so 5 ms looks read 0 or 10
   * beside a smooth measure, and a share read look by look lost every lump — eight spinners that took 25 s were charged
   * 7 and ran past their limit. Over the window it is the 5 a look the threads truly took, shared between them.
   */
  it('shares what the threads took over a window, so the system’s lumpy count is charged whole', async () => {
    vi.useFakeTimers();
    const { state, readProcess, readMain, readIsolate } = clocks();
    const meter = createCpuMeter(5, 1, readProcess, readMain);
    const metered = [0, 1, 2, 3].map(index => meter.meter(readIsolate(index)));

    // Forty looks: four isolates measured 5 ms each a look, the threads counted 0 and 10 by turns — 5 a look, one core.
    for (let look = 0; look < 40; look += 1) {
      state.process += look % 2 === 0 ? 0 : 10;
      state.isolates = state.isolates.map(measured => measured + 5);
      await vi.advanceTimersByTimeAsync(5);
    }

    // 200 ms of one core between four: 50 each, give or take the first look's lump.
    metered.forEach(each => expect(each.charged()).toBeGreaterThan(45));
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
