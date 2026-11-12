import { afterAll, describe, expect, it } from 'vitest';

import { createIsolateRunner, PBKDF2_MAX_ITERATIONS } from './isolate';
import { bundleOf, invoke, messageOf, meterCharging, reasonOf, spinFor, valueOf } from './tests/guest';

/**
 * An invocation's limits, as the runner holds them: each stops the code by the rule its message says, and never by the
 * clock of a runner crowded around it. Moved from `sdk-actions`: a limit broken here fails this
 * package's suite, with no engine built.
 */

const runner = createIsolateRunner({ concurrency: 4 });

afterAll(async () => {
  await runner.close?.();
});

describe("an invocation's limits", () => {
  it('stops code that spins, by CPU time, after an await too', async () => {
    const started = Date.now();
    const outcome = await invoke(runner, bundleOf('await Promise.resolve(); while (true) {}'), { cpuMs: 50 });

    expect(messageOf(outcome)).toBe('Stopped after 50 ms of CPU');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  // A sleep past its time used to be cut to the limit: the code woke at it and, the watchdog a look behind, finished.
  it('stops a sleep past its time by its time limit, never cutting it short to finish', async () => {
    const sleeper = bundleOf('await new Promise(r => setTimeout(r, 3000)); return "woke";');
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => invoke(runner, sleeper, { wallMs: 300 })));

    expect(outcomes.map(messageOf)).toEqual(Array.from({ length: 5 }, () => 'Did not finish within 300 ms'));
  });

  it('leaves a long timer the code clears alone, when the code finishes in time', async () => {
    const outcome = await invoke(
      runner,
      bundleOf('const guard = setTimeout(() => {}, 60000); clearTimeout(guard); return "done";'),
      { wallMs: 300 }
    );

    expect(outcome).toEqual({ value: 'done' });
  });

  // Each is charged its share of the process's CPU: a burst of spinners on one core is stopped by the CPU it took.
  it('stops code that spins beside many others on one core, by the CPU it took', async () => {
    const crowded = createIsolateRunner({ concurrency: 12, turns: 1 });
    const started = Date.now();
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () => invoke(crowded, bundleOf(spinFor(20_000)), { cpuMs: 50 }))
    );

    outcomes.forEach(outcome => expect(messageOf(outcome)).toBe('Stopped after 50 ms of CPU'));
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  /**
   * What the limit is judged by — the regression this guards: V8 counts the time an isolate waited for a core as its CPU,
   * and under a burst a 5 ms route was stopped at its 100 ms limit. A meter here charges what a crowded runner would —
   * a tenth of what each is measured at — or ten times it: the limit follows what is charged, never what V8 measured.
   */
  it('judges the CPU limit by what the meter charges, not by what V8 measured', async () => {
    const crowded = createIsolateRunner({ cpuMeter: meterCharging(0.1) });
    const charged = createIsolateRunner({ cpuMeter: meterCharging(10) });

    // Measured 300 ms against a 100 ms limit, charged 30: it ran its share of a crowded core, and finishes.
    expect(await invoke(crowded, bundleOf(spinFor(300)), { cpuMs: 100 })).toEqual({ value: 'done' });
    // Measured 30 ms, charged 300: stopped by what it was charged.
    expect(messageOf(await invoke(charged, bundleOf(spinFor(30)), { cpuMs: 100 }))).toBe('Stopped after 100 ms of CPU');
  });

  // The other half: code that takes a few ms beside spinners on one core is never charged the core it waited for — a
  // 5 ms route was stopped at a 100 ms limit under load when the time it waited counted.
  it('never stops light code for the CPU others took beside it', async () => {
    const crowded = createIsolateRunner({ concurrency: 16, turns: 1 });
    const [, lights] = await Promise.all([
      Promise.all(Array.from({ length: 8 }, () => invoke(crowded, bundleOf(spinFor(1500)), { cpuMs: 1000 }))),
      Promise.all(Array.from({ length: 8 }, () => invoke(crowded, bundleOf(spinFor(5)), { cpuMs: 50 })))
    ]);

    expect(lights.map(valueOf)).toEqual(Array.from({ length: 8 }, () => 'done'));
  });

  /**
   * The wall's regression: a run's time was the clock, and on a crowded runner — a core it was ready for and did not
   * get, a place behind spinners in isolated-vm's threads — a route that slept 200 ms was stopped at its 10 s. Its time
   * is what it waited on and the CPU it was charged: here a meter charges a hundredth of what V8 measured, as a crowded
   * core would, and 1.5 s of the clock is 15 ms of its own — inside a 500 ms limit.
   */
  it("judges a run's time limit by what it waited on and the CPU it took, never by the clock", async () => {
    const hundredth = createIsolateRunner({ cpuMeter: meterCharging(0.01) });

    expect(await invoke(hundredth, bundleOf(spinFor(1500)), { cpuMs: 1000, wallMs: 500 })).toEqual({ value: 'done' });
  });

  // A sleep counts what it asked for: the runner's main thread woke a 200 ms sleep seconds late on a crowded runner, and a
  // route was stopped at its 10 s for it. Its main thread held here, the sleep wakes late — the code finishes in time.
  it('counts a sleep as what it asked for, never the runner waking it late', async () => {
    const running = invoke(runner, bundleOf('await new Promise(r => setTimeout(r, 100)); return "woke";'), {
      wallMs: 300
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    const busyUntil = Date.now() + 600;
    while (Date.now() < busyUntil) {
      // The runner's main thread, held: its timers — the code's sleep among them — fire late.
    }

    expect(await running).toEqual({ value: 'woke' });
  });

  /**
   * A runner short of memory gives back the invocation that holds the most — within its own limit, as `busy`, for
   * another runner — and the rest go on: before, they grew together past the container's limit, and the kernel killed
   * the runner with every one of them in it.
   */
  it('gives back the invocation holding the most memory, and leaves the others running', async () => {
    const own = createIsolateRunner();
    // About 16 MB, under its own 32: what it holds is the most, and within its limit.
    const hog = invoke(
      own,
      bundleOf(
        'const kept = []; for (let i = 0; i < 40; i++) { kept.push(new Array(5e4).fill(i + 0.5)); await new Promise(r => setTimeout(r, 20)); } return kept.length;'
      ),
      { cpuMs: 2000, wallMs: 20_000 }
    );
    const light = invoke(own, bundleOf('await new Promise(r => setTimeout(r, 600)); return "light";'), {
      cpuMs: 1000
    });
    await new Promise(resolve => setTimeout(resolve, 250));

    const gave = own.shed();

    expect(gave?.overItsOwn).toBe(false);
    // Over capacity, given back for the worker to try again on another runner — never the code's failure.
    const given = await hog;

    expect(reasonOf(given)).toBe('busy');
    expect(messageOf(given)).toContain('ran short of memory');
    expect(await light).toEqual({ value: 'light' });
  });

  // What was not its own is the runner's, and told: the platform's wait for the answer grows by it, or runs out first.
  it("tells the platform the time that was the runner's, so its wait for the answer grows by it", async () => {
    let told = 0;
    await invoke(
      createIsolateRunner({ cpuMeter: meterCharging(0.01) }),
      bundleOf(spinFor(1000)),
      { cpuMs: 5000, wallMs: 30_000 },
      {
        onWaited: ms => {
          told += ms;
        }
      }
    );

    // A second of the clock, a hundredth of it charged: nearly all of it told as the runner's.
    expect(told).toBeGreaterThan(800);
  });

  // The runner derives outside the isolate's clock: what it took is the run's all the same.
  it('stops a run whose PBKDF2 derivations take more CPU than it may', async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        const encode = text => new TextEncoder().encode(text);
        const password = await crypto.subtle.importKey('raw', encode('pw'), 'PBKDF2', false, ['deriveBits']);
        const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-512', salt: encode('salt'), iterations: ${String(PBKDF2_MAX_ITERATIONS)} };
        await crypto.subtle.deriveBits(pbkdf2, password, 512);
        await crypto.subtle.deriveBits(pbkdf2, password, 512);
        return 'derived';`),
      { cpuMs: 20 }
    );

    expect(messageOf(outcome)).toBe('Stopped after 20 ms of CPU');
  });

  it('stops code that takes more memory than its size, says the size to ask for, and the next one runs', async () => {
    // Chunks half the small size: it is crossed in an allocation or two. The CPU at its ceiling — left at 100 ms, the
    // collector's fight near the limit spent it first on a busy CI runner.
    const outcome = await invoke(
      runner,
      bundleOf('const keep = []; while (true) { keep.push(new Array(2e6).fill(Math.random())); }'),
      { cpuMs: 2000, memoryMb: 32 }
    );

    expect(messageOf(outcome)).toContain(
      "Went over its 32 MB of memory (a small task): a task that needs more asks to be larger in its limits ({ size: 'medium' })"
    );
    expect(await invoke(runner, bundleOf('return "fine";'))).toEqual({ value: 'fine' });
  });

  it('stops code that calls the platform more than it may', async () => {
    const outcome = await invoke(
      runner,
      bundleOf('for (let i = 0; i < 10; i++) { await ctx.kv.get("k"); } return 1;'),
      {
        calls: 3
      },
      { answer: () => Promise.resolve(null) }
    );

    expect(messageOf(outcome)).toBe('Made more than the 3 calls to the platform it may');
  });

  it('refuses an answer larger than it may be', async () => {
    const outcome = await invoke(runner, bundleOf('return "x".repeat(5000);'), { outputBytes: 1000 });

    expect(messageOf(outcome)).toBe('Answered more than the 1000 bytes it may');
  });

  it("reports the code's own error as its own", async () => {
    expect(await invoke(runner, bundleOf('throw new Error("no feed today");'))).toMatchObject({
      reason: 'error',
      message: 'no feed today'
    });
  });
});
