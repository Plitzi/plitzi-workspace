import { describe, expect, it } from 'vitest';

import { createIsolateRunner, PBKDF2_MAX_ITERATIONS } from '@plitzi/sdk-runtime/runner';

import { sourceOf, spaceWith } from './tests/isolateSpace';

import type { CpuMeter } from '@plitzi/sdk-runtime/runner';

describe('an invocation’s limits', () => {
  it('stops code that spins, by CPU time, after an await too', async () => {
    const space = await spaceWith(sourceOf('await Promise.resolve(); while (true) {}'), { limits: { cpuMs: 50 } });
    const started = Date.now();
    const result = await space.run();

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ms of CPU');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  // A sleep past its time used to be cut to the limit: the code woke at it and, the watchdog a look behind, finished.
  it('stops a sleep past its time by its time limit, never cutting it short to finish', async () => {
    const space = await spaceWith(
      sourceOf('await new Promise(r => setTimeout(r, 3000)); return "woke";', {
        asks: { cpuMs: 1000, wallMs: 300 }
      })
    );
    const results = await Promise.all(Array.from({ length: 5 }, () => space.run()));

    expect(results.map(result => result.status)).toEqual(Array.from({ length: 5 }, () => 'failed'));
    results.forEach(result => expect(result.error).toContain('Did not finish within 300 ms'));
  });

  it('leaves a long timer the code clears alone, when the code finishes in time', async () => {
    const space = await spaceWith(
      sourceOf('const guard = setTimeout(() => {}, 60000); clearTimeout(guard); return "done";', {
        asks: { cpuMs: 1000, wallMs: 300 }
      })
    );

    expect((await space.run()).value).toBe('done');
  });

  // Each is charged its share of the process's CPU: a burst of spinners on one core is stopped by the CPU it took.
  it('stops code that spins beside many others on one core, by the CPU it took', async () => {
    const crowded = createIsolateRunner({ concurrency: 12, turns: 1 });
    const space = await spaceWith(
      sourceOf('const until = Date.now() + 20000; while (Date.now() < until) {} return 1;'),
      {
        limits: { cpuMs: 50 },
        runner: crowded
      }
    );
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: 12 }, () => space.run()));

    results.forEach(result => expect(result.error).toContain('ms of CPU'));
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  /**
   * What the limit is judged by — the regression this guards: V8 counts the time an isolate waited for a core as its CPU,
   * and under a burst a 5 ms route was stopped at its 100 ms limit. A meter here charges what a crowded runner would —
   * a tenth of what each is measured at — or ten times it: the limit follows what is charged, never what V8 measured.
   */
  it('judges the CPU limit by what the meter charges, not by what V8 measured', async () => {
    const meterCharging = (share: number): CpuMeter => ({
      meter: read => {
        const from = read();

        return { charged: () => (read() - from) * share, end: () => undefined };
      }
    });
    const spin = (ms: number) =>
      sourceOf(`const until = Date.now() + ${String(ms)}; while (Date.now() < until) {} return "done";`, {
        asks: { cpuMs: 100 }
      });
    const crowded = await spaceWith(spin(300), { runner: createIsolateRunner({ cpuMeter: meterCharging(0.1) }) });
    const charged = await spaceWith(spin(30), { runner: createIsolateRunner({ cpuMeter: meterCharging(10) }) });

    // Measured 300 ms against a 100 ms limit, charged 30: it ran its share of a crowded core, and finishes.
    expect((await crowded.run()).value).toBe('done');
    // Measured 30 ms, charged 300: stopped by what it was charged.
    expect((await charged.run()).error).toContain('ms of CPU');
  });

  // The other half: code that takes a few ms beside spinners on one core is never charged the core it waited for — a
  // 5 ms route was stopped at a 100 ms limit under load when the time it waited counted.
  it('never stops light code for the CPU others took beside it', async () => {
    const crowded = createIsolateRunner({ concurrency: 16, turns: 1 });
    const spinners = await spaceWith(
      sourceOf('const until = Date.now() + 1500; while (Date.now() < until) {} return 1;'),
      {
        runner: crowded
      }
    );
    const light = await spaceWith(
      sourceOf('const until = Date.now() + 5; while (Date.now() < until) {} return "light";', { asks: { cpuMs: 50 } }),
      { runner: crowded }
    );
    const [, lights] = await Promise.all([
      Promise.all(Array.from({ length: 8 }, () => spinners.run())),
      Promise.all(Array.from({ length: 8 }, () => light.run()))
    ]);

    expect(lights.map(result => result.value)).toEqual(Array.from({ length: 8 }, () => 'light'));
  });

  /**
   * The wall's regression: a run's time was the clock, and on a crowded runner — a core it was ready for and did not
   * get, a place behind spinners in isolated-vm's threads — a route that slept 200 ms was stopped at its 10 s. Its time
   * is what it waited on and the CPU it was charged: here a meter charges a hundredth of what V8 measured, as a crowded
   * core would, and 1.5 s of the clock is 15 ms of its own — inside a 500 ms limit.
   */
  it('judges a run’s time limit by what it waited on and the CPU it took, never by the clock', async () => {
    const hundredth: CpuMeter = {
      meter: read => {
        const from = read();

        return { charged: () => (read() - from) * 0.01, end: () => undefined };
      }
    };
    const space = await spaceWith(
      sourceOf('const until = Date.now() + 1500; while (Date.now() < until) {} return "done";', {
        asks: { cpuMs: 1000, wallMs: 500 }
      }),
      { runner: createIsolateRunner({ cpuMeter: hundredth }) }
    );

    expect((await space.run()).value).toBe('done');
  });

  // What was not its own is the runner's, and told: the platform's wait for the answer grows by it, or runs out first.
  it('tells the platform the time that was the runner’s, so its wait for the answer grows by it', async () => {
    const crowded: CpuMeter = {
      meter: read => {
        const from = read();

        return { charged: () => (read() - from) * 0.01, end: () => undefined };
      }
    };
    const runner = createIsolateRunner({ cpuMeter: crowded });
    let told = 0;
    await runner.invoke({
      bundle: {
        id: 'clock',
        load: () =>
          Promise.resolve(
            "export default { tasks: [{ namespace: 'p', action: 'run', run: async () => { const until = Date.now() + 1000; while (Date.now() < until) {} return 1; } }] };"
          )
      },
      invocation: {
        kind: 'task',
        name: 'p.run',
        params: {},
        context: { spaceId: 1, environment: 'main', runId: 'clock', trigger: 'call', callerId: 'test' }
      },
      limits: { cpuMs: 5000, wallMs: 30_000, memoryMb: 64, outputBytes: 100_000, calls: 10 },
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal,
      onWaited: ms => {
        told += ms;
      }
    });

    // A second of the clock, a hundredth of it charged: nearly all of it told as the runner's.
    expect(told).toBeGreaterThan(800);
  });

  // The runner derives outside the isolate's clock: what it took is the run's all the same.
  it('stops a run whose PBKDF2 derivations take more CPU than it may', async () => {
    const space = await spaceWith(
      sourceOf(`
        const encode = text => new TextEncoder().encode(text);
        const password = await crypto.subtle.importKey('raw', encode('pw'), 'PBKDF2', false, ['deriveBits']);
        const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-512', salt: encode('salt'), iterations: ${String(PBKDF2_MAX_ITERATIONS)} };
        await crypto.subtle.deriveBits(pbkdf2, password, 512);
        await crypto.subtle.deriveBits(pbkdf2, password, 512);
        return 'derived';`),
      { limits: { cpuMs: 20 } }
    );
    const result = await space.run();

    expect(result.status).toBe('failed');
    expect(result.error).toContain('ms of CPU');
  });

  it('stops code that takes more memory than it may, and the next one runs', async () => {
    // Chunks the size of the whole limit: it is crossed in an allocation or two. The task asks for the CPU ceiling —
    // left at the default 100 ms, the collector's fight near the limit spent it first on a busy CI runner.
    const hog = await spaceWith(
      sourceOf('const keep = []; while (true) { keep.push(new Array(2e6).fill(Math.random())); }', {
        asks: { cpuMs: 2000 }
      }),
      { limits: { memoryMb: 16 } }
    );
    const next = await spaceWith(sourceOf('return "fine";'));

    expect((await hog.run()).error).toContain('MB of memory');
    expect((await next.run()).value).toBe('fine');
  });

  it('stops code that calls the platform more than it may', async () => {
    const space = await spaceWith(sourceOf('for (let i = 0; i < 10; i++) { await ctx.kv.get("k"); } return 1;'), {
      limits: { calls: 3 }
    });

    expect((await space.run()).error).toContain('calls to the platform');
  });

  it('refuses an answer larger than it may be', async () => {
    const space = await spaceWith(sourceOf('return "x".repeat(5000);'), { limits: { outputBytes: 1000 } });

    expect((await space.run()).error).toContain('bytes it may');
  });

  it('reports the code’s own error as the step’s', async () => {
    const space = await spaceWith(sourceOf('throw new Error("no feed today");'));

    expect((await space.run()).error).toBe('no feed today');
  });
});
