import { describe, expect, it } from 'vitest';

import { TELL_WAITED_MS, createRunClock } from './runClock';

/** A clock the test moves by hand, and the CPU it says the isolate was charged. */
const handClock = () => {
  let at = 1000;
  let cpu = 0;
  const clock = createRunClock({ now: () => at });

  return {
    clock,
    pass: (ms: number) => {
      at += ms;
    },
    spend: (ms: number) => {
      at += ms;
      cpu += ms;
    },
    begin: () => clock.begin(() => cpu)
  };
};

describe("an invocation's own time", () => {
  it('is nothing before its code begins: making the isolate and compiling are the platform’s', () => {
    const { clock, pass, begin } = handClock();
    pass(400);

    expect(clock.ownMs()).toBe(0);
    begin();
    expect(clock.ownMs()).toBe(0);
  });

  it('is the CPU it was charged and what it waited on, never the clock between', () => {
    const { clock, pass, spend, begin } = handClock();
    begin();
    spend(30);
    // A core it was ready for and did not get: the clock moves, its time does not.
    pass(500);
    clock.waitBegins();
    pass(200);
    clock.waitEnds();

    expect(clock.ownMs()).toBe(230);
    expect(clock.elapsedMs()).toBe(730);
  });

  it('counts waiting on several answers at once once', () => {
    const { clock, pass, begin } = handClock();
    begin();
    clock.waitBegins();
    pass(100);
    clock.waitBegins();
    pass(100);
    clock.waitEnds();

    expect(clock.waits()).toBe(1);
    expect(clock.ownMs()).toBe(200);
    clock.waitEnds();
    pass(100);
    expect(clock.ownMs()).toBe(200);
  });

  it('charges what the runner spent on its behalf to its CPU, before its code began too', () => {
    const { clock, begin } = handClock();
    clock.chargeHost(15);

    expect(clock.chargedCpu()).toBe(15);
    begin();
    expect(clock.hostCpuMs()).toBe(15);
  });
});

describe('a sleep', () => {
  it('counts what it asked for, never the runner waking it late', () => {
    const { clock, pass, begin } = handClock();
    begin();
    const plan = clock.sleep(100, 300);
    clock.waitBegins();
    // The runner's main thread held: the sleep wakes 600 ms late.
    pass(700);

    expect(plan.wakes).toBe(true);
    // Still asleep past its time: the lateness is the runner's already.
    expect(clock.ownMs()).toBe(100);
    if (plan.wakes) {
      plan.woke();
    }

    clock.waitEnds();
    expect(clock.ownMs()).toBe(100);
  });

  it('past the time it has left ends the run at it, never cut short to fit', () => {
    const { clock, spend, begin } = handClock();
    begin();
    spend(50);

    expect(clock.sleep(3000, 300)).toEqual({ wakes: false, stopInMs: 250 });
    expect(clock.sleep(250, 300)).toEqual({ wakes: false, stopInMs: 250 });
    expect(clock.sleep(-5, 300)).toMatchObject({ wakes: true, wanted: 0 });
  });
});

describe('the limits it is judged by', () => {
  it('stops it for its CPU first, then for its time, and not before either is past', () => {
    const { clock, spend, pass, begin } = handClock();
    begin();
    spend(100);

    expect(clock.overLimit({ cpuMs: 100, wallMs: 1000 })).toBeUndefined();
    spend(1);
    expect(clock.overLimit({ cpuMs: 100, wallMs: 50 })).toBe('cpu');
    clock.waitBegins();
    pass(1000);
    expect(clock.overLimit({ cpuMs: 1000, wallMs: 1000 })).toBe('wall');
  });
});

describe('what of the clock was the runner’s', () => {
  it("is told once it is a tell's worth, and only what was not told before", () => {
    const { clock, pass, spend, begin } = handClock();
    begin();
    spend(10);
    pass(TELL_WAITED_MS - 1);

    expect(clock.untoldWaitedMs()).toBeUndefined();
    pass(1);
    expect(clock.untoldWaitedMs()).toBe(TELL_WAITED_MS);
    expect(clock.untoldWaitedMs()).toBeUndefined();
    pass(250);
    expect(clock.untoldWaitedMs()).toBe(250);
  });
});
