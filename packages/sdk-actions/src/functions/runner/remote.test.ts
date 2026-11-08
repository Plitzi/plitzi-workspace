import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { invocationFootprintMb, startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';
import { FUNCTIONS_PROTOCOL, FunctionFailure } from '@plitzi/sdk-shared/functions';

import { createRemoteRunner } from './remote';
import { createActionsModule } from '../../engine/module';
import { functionsInHand } from '../space';

import type { FunctionsRunnerService } from '@plitzi/sdk-runtime/runner';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';
import type { FunctionInvocation, FunctionLimits, FunctionRunner, SpaceFunctions } from '@plitzi/sdk-shared/functions';

const SECRET = 'a-runner-secret-of-at-least-32-characters';

const LIMITS: FunctionLimits = { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 100_000, calls: 20 };

const invocation: FunctionInvocation = {
  kind: 'task',
  name: 'probe.run',
  params: {},
  context: { spaceId: 3, environment: 'main', runId: 'run-1', trigger: 'call', callerId: 'ip:1' }
};

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const ENTRY: ActionEntry = {
  id: 'probe',
  document: {
    name: 'Probe',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'probe' }),
      probe: node('probe', { action: 'probe.run', afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ probe|json_encode }}}' } })
    }
  }
};

const SOURCE = {
  'index.ts': `export default {
  tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, run: async (_params, ctx) => {
    await ctx.kv.increment('hits', 1);
    return { hits: await ctx.kv.get('hits') };
  } }]
};`
};

let service: FunctionsRunnerService;
let remote: FunctionRunner;

beforeAll(async () => {
  service = await startFunctionsRunnerService({ secret: SECRET, port: 0, host: '127.0.0.1' });
  remote = createRemoteRunner({ url: `ws://127.0.0.1:${String(service.address().port)}`, secret: SECRET });
});

afterAll(() => service.close());

describe('the runner service, through the remote runner', () => {
  it('runs a space’s task with its calls answered by the platform that asked', async () => {
    const probe = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      functions: { runner: remote }
    });
    const prepared = await probe.prepareFunctions(SOURCE);
    if (!prepared.ok) {
      throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
    }

    const functions: SpaceFunctions = functionsInHand(prepared.functions);
    const module = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined), getFunctions: () => Promise.resolve(functions) },
      functions: { runner: remote }
    });
    const run = () =>
      module.runAction({
        entry: ENTRY,
        input: {},
        callerId: 'ip:1',
        spaceId: 3,
        environment: 'main',
        trigger: 'call',
        runId: `run-${String(Math.random())}`
      });

    expect((await run()).output.value).toEqual({ hits: 1 });
    expect((await run()).output.value).toEqual({ hits: 2 });
  });

  it('is sent a bundle only when it does not have it', async () => {
    const code = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';
    const firstLoad = vi.fn(() => Promise.resolve(code));
    const secondLoad = vi.fn(() => Promise.resolve('not sent, so never compiled'));
    const answer = vi.fn(() => Promise.resolve(null));
    const signal = new AbortController().signal;
    const cold = await remote.invoke({
      bundle: { id: 'bundle-sent-once', load: firstLoad },
      invocation,
      limits: LIMITS,
      answer,
      signal
    });
    const warm = await remote.invoke({
      bundle: { id: 'bundle-sent-once', load: secondLoad },
      invocation,
      limits: LIMITS,
      answer,
      signal
    });

    expect([cold, warm]).toEqual(['ran', 'ran']);
    expect(firstLoad).toHaveBeenCalledTimes(1);
    expect(secondLoad).not.toHaveBeenCalled();
  });

  it('carries back what the invocation spent', async () => {
    const onUsage = vi.fn();
    await remote.invoke({
      bundle: {
        id: 'bundle-usage',
        load: () => Promise.resolve('export default { tasks: [{ namespace: "probe", action: "run", run: () => 1 }] };')
      },
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal,
      onUsage
    });

    expect(onUsage).toHaveBeenCalledWith({
      cpuMs: expect.any(Number) as number,
      wallMs: expect.any(Number) as number,
      calls: 0
    });
  });

  // A runner restarting is a few seconds with nothing listening: the invocation, never sent, waits for it.
  it('tries a runner that cannot be reached again, and goes through once it is back', async () => {
    const free = await startFunctionsRunnerService({ secret: SECRET, port: 0, host: '127.0.0.1' });
    const { port } = free.address();
    await free.close();
    const later = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET });
    let back: FunctionsRunnerService | undefined;
    setTimeout(() => {
      void startFunctionsRunnerService({ secret: SECRET, port, host: '127.0.0.1' }).then(started => {
        back = started;
      });
    }, 700);

    const answer = await later.invoke({
      bundle: {
        id: 'bundle-after-restart',
        load: () =>
          Promise.resolve('export default { tasks: [{ namespace: "probe", action: "run", run: () => "back" }] };')
      },
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal
    });

    expect(answer).toBe('back');
    expect(later.reachable?.(3)).toBe(true);
    await back?.close();
  });

  // Nothing listening for longer: said as found nowhere — never run — and the runner is taken as away for a while.
  it('says when no runner could be reached at all, and that it is away', async () => {
    const free = await startFunctionsRunnerService({ secret: SECRET, port: 0, host: '127.0.0.1' });
    const { port } = free.address();
    await free.close();
    const gone = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET });

    const failure: unknown = await gone
      .invoke({
        bundle: { id: 'bundle-nowhere', load: () => Promise.resolve('export default {};') },
        invocation,
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      })
      .catch((error: unknown) => error);

    expect(failure instanceof FunctionFailure && failure.reason).toBe('unreachable');
    expect(gone.reachable?.(3)).toBe(false);
  }, 15_000);

  it('refuses a platform without the secret', async () => {
    const stranger = createRemoteRunner({
      url: `ws://127.0.0.1:${String(service.address().port)}`,
      secret: 'x'.repeat(40)
    });
    const failure: unknown = await stranger
      .describe({ id: 'x', code: 'export default {};' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FunctionFailure);
    // Turned away, nothing ran: never said as a runner that went away while it ran it.
    expect(String(failure)).toContain('turned this platform away');
  });

  /**
   * A runner that goes away while it runs the invocation — the kernel killed it for memory — is the platform's, said as
   * `lost`: never the code's `error`, nor `unreachable`, which is sent again though it may have run in part.
   */
  it('says a runner that went away mid-invocation lost it, the platform’s, and does not send it again', async () => {
    const dying = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    let sent = 0;
    dying.on('connection', socket => {
      socket.on('message', () => {
        sent += 1;
        socket.send(JSON.stringify({ type: 'accepted' }));
        socket.terminate();
      });
    });
    await new Promise<void>(resolve => dying.on('listening', () => resolve()));
    const address = dying.address();
    const port = address && typeof address === 'object' ? address.port : 0;
    const runner = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET });

    try {
      const failure: unknown = await runner
        .invoke({
          bundle: { id: 'gone', load: () => Promise.resolve('export default {};') },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
        .catch((error: unknown) => error);

      expect(failure instanceof FunctionFailure && failure.reason).toBe('lost');
      expect(String(failure)).toContain('it may have run in part');
      expect(sent).toBe(1);
    } finally {
      dying.close();
    }
  });

  // A refusal is the code's answer, not a fault: across the wire it stays a refusal, with its reason.
  it('carries back a refusal as one', async () => {
    const bundle = {
      id: 'bundle-that-refuses',
      load: () =>
        Promise.resolve(
          'class ActionRefusal extends Error { constructor(m) { super(m); this.name = "ActionRefusal"; } }\n' +
            'export default { tasks: [{ namespace: "probe", action: "run", run: () => { throw new ActionRefusal("Board is full"); } }] };'
        )
    };
    const failure: unknown = await remote
      .invoke({
        bundle,
        invocation,
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      })
      .catch((error: unknown) => error);

    expect(failure instanceof FunctionFailure && [failure.reason, failure.message]).toEqual([
      'refused',
      'Board is full'
    ]);
  });

  it('stops an invocation the run aborted', async () => {
    const controller = new AbortController();
    const bundle = {
      id: 'bundle-that-waits',
      load: () =>
        Promise.resolve(
          'export default { tasks: [{ namespace: "probe", action: "run", run: () => new Promise(() => {}) }] };'
        )
    };
    const invoked = remote.invoke({
      bundle,
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: controller.signal
    });
    setTimeout(() => controller.abort(), 50);
    const failure: unknown = await invoked.catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FunctionFailure);
    expect(failure instanceof FunctionFailure && failure.reason).toBe('aborted');
  });

  it('gives up on a runner that stops answering, and closes the connection', async () => {
    // It takes the invocation, then says nothing more: its time runs from the moment it took it.
    const silent = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    const closed = new Promise<void>(resolve => {
      silent.on('connection', socket => {
        socket.on('message', () => socket.send(JSON.stringify({ type: 'accepted' })));
        socket.on('close', () => resolve());
      });
    });
    await new Promise<void>(resolve => silent.on('listening', () => resolve()));
    const address = silent.address();
    const port = address && typeof address === 'object' ? address.port : 0;
    const hung = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET, graceMs: 50 });
    const started = Date.now();
    const failure: unknown = await hung
      .invoke({
        bundle: { id: 'x', load: () => Promise.resolve('') },
        invocation,
        limits: { ...LIMITS, wallMs: 100 },
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      })
      .catch((error: unknown) => error);
    await closed;
    silent.close();

    expect(failure instanceof FunctionFailure && failure.reason).toBe('wall');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  // Waiting for the runner's CPU is the runner's time: an invocation that waited its turn is not cut by the platform.
  it('waits longer for a runner that says it waited for its CPU, by what it waited', async () => {
    const turnTaking = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    turnTaking.on('connection', socket => {
      socket.on('message', () => {
        socket.send(JSON.stringify({ type: 'accepted' }));
        socket.send(JSON.stringify({ type: 'waited', ms: 400 }));
        // Past its 150 ms of time and grace, within them and what it waited.
        setTimeout(() => socket.send(JSON.stringify({ type: 'done', value: 'waited its turn' })), 300);
      });
    });
    await new Promise<void>(resolve => turnTaking.on('listening', () => resolve()));
    const address = turnTaking.address();
    const port = address && typeof address === 'object' ? address.port : 0;
    const patient = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET, graceMs: 50 });
    const waited: number[] = [];

    try {
      expect(
        await patient.invoke({
          bundle: { id: 'x', load: () => Promise.resolve('') },
          invocation,
          limits: { ...LIMITS, wallMs: 100 },
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal,
          onWaited: ms => waited.push(ms)
        })
      ).toBe('waited its turn');
      // Told on, for the run's own time limit to move by it too.
      expect(waited).toContain(400);
    } finally {
      turnTaking.close();
    }
  });

  /**
   * A run's time is its execution alone. Its wait for a runner with room was told only once a runner took it: a wait
   * longer than what the run had left ended it as over its budget before it had run at all (`Action exceeded its
   * 10000ms budget`, a load round's medium and large actions). Told as it lasts, the run's limit moves with it.
   */
  it('tells a wait in a runner’s queue as it lasts, not only once the runner takes it', async () => {
    const full = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    let acceptedAt = 0;
    full.on('connection', socket => {
      socket.on('message', () => {
        socket.send(JSON.stringify({ type: 'queued' }));
        setTimeout(() => {
          acceptedAt = Date.now();
          socket.send(JSON.stringify({ type: 'accepted' }));
          socket.send(JSON.stringify({ type: 'done', value: 'ran once there was room' }));
        }, 700);
      });
    });
    await new Promise<void>(resolve => full.on('listening', () => resolve()));
    const address = full.address();
    const port = address && typeof address === 'object' ? address.port : 0;
    const runner = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET });
    const told: { ms: number; at: number }[] = [];

    try {
      expect(
        await runner.invoke({
          bundle: { id: 'x', load: () => Promise.resolve('') },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal,
          onWaited: ms => told.push({ ms, at: Date.now() })
        })
      ).toBe('ran once there was room');
      // Said several times before the runner took it, and the whole wait said.
      expect(told.filter(each => each.at < acceptedAt).length).toBeGreaterThanOrEqual(2);
      expect(told.reduce((total, each) => total + each.ms, 0)).toBeGreaterThanOrEqual(650);
    } finally {
      full.close();
    }
  });

  it('answers its stats behind its secret: what it ran, its isolates and the protocol it speaks', async () => {
    const stats = `http://127.0.0.1:${String(service.address().port)}/_stats`;

    const read = (await (await fetch(stats, { headers: { authorization: `Bearer ${SECRET}` } })).json()) as {
      pool: string;
      protocol: string;
      load: { slots: Record<string, { used: number; of: number }> };
      outcomes: { '60m': { runs: number } };
    };

    expect(read.pool).toBe('runner');
    expect(read.protocol).toBe(FUNCTIONS_PROTOCOL);
    expect(read.load.slots.isolates).toEqual({ used: 0, of: 8 });
    expect(read.outcomes['60m'].runs).toBeGreaterThan(0);
    expect((await fetch(stats)).status).toBe(401);
  });

  // A runner short of memory is the runners' capacity, never the code's error: the invocation waits for room, and runs.
  it('keeps an invocation it has no memory for until it has, and runs it then', async () => {
    const MIB = 1_048_576;
    // 90 of 100 MiB held: past the 85% it takes work to, whatever an invocation is kept.
    let usedBytes = 90 * MIB;
    const full = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes, limitBytes: 100 * MIB })
    });
    const runner = createRemoteRunner({ url: `ws://127.0.0.1:${String(full.address().port)}`, secret: SECRET });
    const code = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';

    try {
      let answered = false;
      const asked = runner
        .invoke({
          bundle: { id: 'kept', load: () => Promise.resolve(code) },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
        .finally(() => {
          answered = true;
        });
      await new Promise(resolve => setTimeout(resolve, 400));
      expect(answered).toBe(false);

      usedBytes = 0;
      expect(await asked).toBe('ran');
    } finally {
      await full.close();
    }
  });

  /**
   * Each invocation is reserved what it may hold, whole, from the moment it is taken until it ends: a share let the ones
   * it took grow together past the container's limit, and the kernel killed the runner with all of them in it. 64 MiB
   * may hold 79 (`invocationFootprintMb`) of the 85 it takes work to: one at a time, the rest kept until it ends — never
   * refused, never two on room for one.
   */
  it('reserves each invocation what it may hold, whole, and keeps the next until the room is back', async () => {
    const MIB = 1_048_576;
    const burst = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes: 0, limitBytes: 100 * MIB })
    });
    const runner = createRemoteRunner({
      url: `ws://127.0.0.1:${String(burst.address().port)}`,
      secret: SECRET
    });
    const code =
      'export default { tasks: [{ namespace: "probe", action: "run", run: async () => { await new Promise(r => setTimeout(r, 30)); return "ran"; } }] };';
    const once = () =>
      runner
        .invoke({
          bundle: { id: 'burst', load: () => Promise.resolve(code) },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal,
          onWaited: () => undefined
        })
        .then(
          value => value,
          (error: unknown) => (error instanceof FunctionFailure ? error.reason : error)
        );
    try {
      expect(invocationFootprintMb(LIMITS.memoryMb)).toBe(79);
      const started = Date.now();
      expect(await Promise.all(Array.from({ length: 4 }, once))).toEqual(['ran', 'ran', 'ran', 'ran']);
      // Four of 30 ms one after another: run two at once on room for one and they take half of it.
      expect(Date.now() - started).toBeGreaterThanOrEqual(110);
    } finally {
      await burst.close();
    }
  });

  it('spreads its invocations over several runners, and gives a busy one’s to the next', async () => {
    const full = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes: 900, limitBytes: 1000 })
    });
    const urls = [`ws://127.0.0.1:${String(full.address().port)}`, `ws://127.0.0.1:${String(service.address().port)}`];
    let next = 0;
    const asked: string[] = [];
    const runners = createRemoteRunner({
      url: () => {
        const url = urls[next++ % urls.length] ?? '';
        asked.push(url);

        return url;
      },
      secret: SECRET
    });
    const code = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';

    try {
      const value = await runners.invoke({
        bundle: { id: 'bundle-of-two-runners', load: () => Promise.resolve(code) },
        invocation,
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });

      expect(value).toBe('ran');
      expect(asked).toEqual(urls);
    } finally {
      await full.close();
    }
  });

  it('finishes what it runs when it stops, and hands a new invocation to another runner meanwhile', async () => {
    const slow: FunctionRunner = {
      describe: () => Promise.resolve({}),
      invoke: () => new Promise(resolve => setTimeout(() => resolve('finished'), 400))
    };
    const stopping = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      runner: slow,
      shutdown: { graceMs: 5000 }
    });
    const stoppingUrl = `ws://127.0.0.1:${String(stopping.address().port)}`;
    const code = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';
    const ask = (runner: FunctionRunner) =>
      runner.invoke({
        bundle: { id: 'slow-or-ran', load: () => Promise.resolve(code) },
        invocation,
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });

    const running = ask(createRemoteRunner({ url: stoppingUrl, secret: SECRET }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const closed = stopping.close();
    // Asked first of the one stopping — as its name, then its first try: it turns the new invocation away, and the
    // other runs it.
    const order = [stoppingUrl, stoppingUrl, `ws://127.0.0.1:${String(service.address().port)}`];
    let asked = 0;
    const elsewhere = await ask(
      createRemoteRunner({ url: () => order[Math.min(asked++, order.length - 1)] ?? '', secret: SECRET })
    );
    const health = await fetch(stoppingUrl.replace('ws:', 'http:') + '/health').catch(() => undefined);

    expect(await running).toBe('finished');
    expect(elsewhere).toBe('ran');
    expect(health?.status).toBe(503);
    await closed;
  });

  it('asks where to run with the space an invocation is for: what sends a space to the runners it is given', async () => {
    const asked: (number | undefined)[] = [];
    const runner = createRemoteRunner({
      url: spaceId => {
        asked.push(spaceId);

        return `ws://127.0.0.1:${String(service.address().port)}`;
      },
      secret: SECRET
    });
    const code = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';

    await runner.invoke({
      bundle: { id: 'bundle-asked-by-space', load: () => Promise.resolve(code) },
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal
    });

    // Asked again as it is placed, always for the same space.
    expect(new Set(asked)).toEqual(new Set([3]));
  });

  // A runner runs what it may at once and turns the rest away: a full one costs an invocation nothing but a hop.
  describe('placing an invocation on a runner with room', () => {
    const SLEEPY =
      'export default { tasks: [{ namespace: "probe", action: "run", run: (params) => new Promise(resolve => setTimeout(() => resolve(params.ms), params.ms)) }] };';
    const sleepFor = (ms: number) => ({ ...invocation, params: { ms } });
    const one = () => startFunctionsRunnerService({ secret: SECRET, port: 0, host: '127.0.0.1', concurrency: 1 });
    const urlOf = (runner: FunctionsRunnerService) => `ws://127.0.0.1:${String(runner.address().port)}`;
    const ask = (remote: FunctionRunner, ms: number, wallMs = 5000) =>
      remote.invoke({
        bundle: { id: 'sleepy', load: () => Promise.resolve(SLEEPY) },
        invocation: sleepFor(ms),
        limits: { ...LIMITS, wallMs },
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });

    it('takes an invocation a full runner turns away to one with room, at once', async () => {
      const [first, second] = await Promise.all([one(), one()]);
      const urls = [urlOf(first), urlOf(second)];
      let turn = 0;
      const remote = createRemoteRunner({ url: () => urls[turn++ % 2] ?? '', secret: SECRET });
      try {
        // Both warm, so a bundle's first compile is not what is timed.
        await Promise.all([ask(remote, 1), ask(remote, 1)]);
        const holding = ask(remote, 600);
        await new Promise(resolve => setTimeout(resolve, 50));
        const started = Date.now();

        expect(await ask(remote, 50)).toBe(50);
        expect(Date.now() - started).toBeLessThan(400);
        expect(await holding).toBe(600);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    });

    it('waits while every runner is full, and its time starts once one takes it', async () => {
      const only = await one();
      const remote = createRemoteRunner({ url: urlOf(only), secret: SECRET, graceMs: 0 });
      try {
        await ask(remote, 1);
        const holding = ask(remote, 500);
        await new Promise(resolve => setTimeout(resolve, 50));

        // 300 ms of its own, after ~450 waiting for the runner: placed, not queued on it, it is not out of time.
        expect(await ask(remote, 100, 300)).toBe(100);
        expect(await holding).toBe(500);
      } finally {
        await only.close();
      }
    });
  });

  // A runner compiles a bundle it never ran — the first invocation after it starts, mid-burst — and that is the
  // platform's work: the invocation's CPU is its code's alone.
  it('counts an invocation’s CPU from its code, never what compiling its bundle cost', async () => {
    const filler = Array.from(
      { length: 12_000 },
      (_, index) => `const filler${String(index)} = (a) => a + ${String(index)};`
    );
    const code = `${filler.join('\n')}\nexport default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };`;

    const value = await remote.invoke({
      bundle: { id: 'a-bundle-heavy-to-compile', load: () => Promise.resolve(code) },
      invocation,
      limits: { ...LIMITS, cpuMs: 5 },
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal
    });

    expect(value).toBe('ran');
  });

  it('needs a real secret to start', async () => {
    await expect(startFunctionsRunnerService({ secret: 'short' })).rejects.toThrow('at least 32 characters');
  });
});
