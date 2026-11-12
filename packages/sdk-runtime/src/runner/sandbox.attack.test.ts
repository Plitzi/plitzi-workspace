import { afterAll, describe, expect, it } from 'vitest';

import { createIsolateRunner } from './isolate';
import { bundleOf, invoke, reasonOf } from './tests/guest';

/**
 * What a guest tries, and what it gets: each case named after the attempt, each ending in the stop or the refusal the
 * contract names. The sandbox's promise is that a space's code reaches nothing of the host — no `process`, no module
 * loader, no network but `ctx.fetch`, no memory or CPU past its limits, nothing of the invocation before it — and this
 * suite owns that promise, with no engine between it and the runner.
 *
 * Anything this suite finds goes to the maintainer before it is written anywhere public.
 */

const runner = createIsolateRunner({ concurrency: 2 });

afterAll(async () => {
  await runner.close?.();
});

describe('the sandbox, against what a guest tries', () => {
  it('reaching the host through a constructor finds only the isolate', async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        const viaThis = (function () { return this; })();
        const viaFunction = (() => {}).constructor('return typeof process + "/" + typeof require + "/" + typeof globalThis.process')();
        const viaError = new Error().constructor.constructor('return typeof process')();
        return { viaFunction, viaError, global: typeof viaThis?.process };
      `)
    );

    expect(outcome).toEqual({
      value: { viaFunction: 'undefined/undefined/undefined', viaError: 'undefined', global: 'undefined' }
    });
  });

  it("reaching the host through a thrown value's or a ctx method's constructor finds only the isolate", async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        let caught;
        try { null.x; } catch (error) { caught = error.constructor.constructor('return typeof process')(); }
        // Every method of ctx, nested ones too: an async one's constructor is AsyncFunction, its answer a promise.
        const methods = [];
        const walk = (value, depth) => {
          for (const each of Object.values(value ?? {})) {
            if (typeof each === 'function') methods.push(each);
            else if (each && typeof each === 'object' && depth < 2) walk(each, depth + 1);
          }
        };
        walk(ctx, 0);
        const viaCtx = await Promise.all(methods.map(fn => fn.constructor('return typeof process')()));
        return { caught, methods: methods.length, viaCtx: [...new Set(viaCtx)] };
      `)
    );

    expect(outcome).toMatchObject({ value: { caught: 'undefined', viaCtx: ['undefined'] } });
    expect((outcome as { value: { methods: number } }).value.methods).toBeGreaterThan(20);
  });

  it('loading a module of the host is refused', async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        const tries = [];
        for (const name of ['node:fs', 'fs', 'node:child_process', 'node:net']) {
          try { await import(name); tries.push(name + ':loaded'); } catch { tries.push(name + ':refused'); }
        }
        return tries;
      `)
    );

    expect(outcome).toEqual({
      value: ['node:fs:refused', 'fs:refused', 'node:child_process:refused', 'node:net:refused']
    });
  });

  it('reaching the network except through ctx.fetch finds nothing to reach it with', async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        let direct;
        try { await fetch('https://example.com'); direct = 'sent'; } catch (error) { direct = error.message; }
        return { direct, xhr: typeof XMLHttpRequest, socket: typeof WebSocket };
      `)
    );

    expect(outcome).toMatchObject({ value: { xhr: 'undefined', socket: 'undefined' } });
    expect((outcome as { value: { direct: string } }).value.direct).toContain('ctx.fetch');
  });

  it('spinning is stopped by its CPU', async () => {
    expect(await invoke(runner, bundleOf('while (true) {}'), { cpuMs: 50 })).toMatchObject({ reason: 'cpu' });
  });

  it('a regular expression that backtracks without end is stopped by its CPU', async () => {
    const outcome = await invoke(runner, bundleOf(`return /^(a+)+$/.test('a'.repeat(40) + 'b');`), { cpuMs: 50 });

    expect(outcome).toMatchObject({ reason: 'cpu' });
  });

  it('a flood of microtasks is stopped by its CPU', async () => {
    const outcome = await invoke(runner, bundleOf('for (;;) { await Promise.resolve(); }'), { cpuMs: 50 });

    expect(outcome).toMatchObject({ reason: 'cpu' });
  });

  it('a timer that never lets go is stopped by its time', async () => {
    const outcome = await invoke(runner, bundleOf('await new Promise(() => { setInterval(() => {}, 1); });'), {
      wallMs: 300
    });

    expect(outcome).toMatchObject({ reason: 'wall' });
  });

  it('a sleep past its time ends it at its time, never cut short', async () => {
    const outcome = await invoke(runner, bundleOf('await new Promise(done => setTimeout(done, 10_000)); return 1;'), {
      wallMs: 300
    });

    expect(outcome).toMatchObject({ reason: 'wall' });
  });

  it("the runner's own calls are gone from the global before the code is read", async () => {
    const names = ['__plitziCall', '__plitziSleep', '__plitziRandom', '__plitziCrypto'];
    const outcome = await invoke(
      runner,
      bundleOf(
        `return ${JSON.stringify(names)}.filter(name => name in globalThis || Object.getOwnPropertyNames(globalThis).includes(name));`
      )
    );

    expect(outcome).toEqual({ value: [] });
  });

  it("calls past the plan's count stop it, though the code catches every refusal", async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        for (let i = 0; i < 50; i++) {
          try { await ctx.fetch('https://example.com/'); } catch {}
        }
        return 'went on';
      `),
      { calls: 3 }
    );

    expect(outcome).toMatchObject({ reason: 'calls' });
  });

  it('memory taken by an array is stopped by its memory', async () => {
    const grow = 'const kept = []; for (;;) { kept.push(new Array(1e5).fill(1)); }';

    expect(['memory', 'cpu']).toContain(
      reasonOf(await invoke(runner, bundleOf(grow), { memoryMb: 16, cpuMs: 2000, wallMs: 5000 }))
    );
  });

  // Array buffers live outside the heap: the isolate's allocator refuses one past its memory, as a RangeError the code
  // may catch — never the host's memory, and the runner goes on.
  it('array buffers past its memory are refused to the code, and the runner goes on', async () => {
    const grow = 'const kept = []; for (;;) { kept.push(new ArrayBuffer(1024 * 1024)); }';

    expect(['error', 'memory']).toContain(
      reasonOf(await invoke(runner, bundleOf(grow), { memoryMb: 16, cpuMs: 2000, wallMs: 5000 }))
    );
    expect(await invoke(runner, bundleOf('return 2;'))).toEqual({ value: 2 });
  });

  // A doubled string is a rope until it is read: V8's own length limit ends it, as the code's error, before the memory.
  it('a string doubled without end fails the code, and the runner goes on', async () => {
    expect(['error', 'memory', 'cpu']).toContain(
      reasonOf(await invoke(runner, bundleOf("let s = 'x'; for (;;) { s += s; }"), { memoryMb: 16 }))
    );
    expect(await invoke(runner, bundleOf('return 2;'))).toEqual({ value: 2 });
  });

  it('a second invocation finds nothing the first one left', async () => {
    const bundle = bundleOf(`
      const before = globalThis.left;
      const polluted = {}.polluted;
      globalThis.left = 'from the first';
      Object.prototype.polluted = 'yes';
      return { before: before ?? null, polluted: polluted ?? null };
    `);
    await invoke(runner, bundle);

    expect(await invoke(runner, bundle)).toEqual({ value: { before: null, polluted: null } });
  });

  it("a bundle's top level that tries the same is held to the same", async () => {
    const outcome = await invoke(
      runner,
      bundleOf('return globalThis.found;', "globalThis.found = (() => {}).constructor('return typeof process')();")
    );

    expect(outcome).toEqual({ value: 'undefined' });
    expect(['cpu', 'wall', 'error']).toContain(
      reasonOf(await invoke(runner, bundleOf('return 1;', 'while (true) {}'), { cpuMs: 50 }))
    );
  });
});
