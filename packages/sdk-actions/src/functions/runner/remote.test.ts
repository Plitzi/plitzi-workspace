import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';
import { FUNCTIONS_PROTOCOL, FunctionFailure } from '@plitzi/sdk-shared/functions';

import { createRemoteRunner } from './remote';
import { createActionsModule } from '../../engine/module';
import { functionsInHand } from '../space';

import type { FunctionsRunnerService, FunctionsRunnerServiceOptions } from '@plitzi/sdk-runtime/runner';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';
import type { FunctionInvocation, FunctionLimits, FunctionRunner, SpaceFunctions } from '@plitzi/sdk-shared/functions';

const SECRET = 'a-runner-secret-of-at-least-32-characters';

/** A runner with all its CPU free, whatever the machine running the tests is doing, unless a test says otherwise. */
const startRunner = (options: FunctionsRunnerServiceOptions) =>
  startFunctionsRunnerService({ readLoad: () => ({ cpuCores: 0, cpuShare: 0, lagMs: 0 }), ...options });

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
  service = await startRunner({ secret: SECRET, port: 0, host: '127.0.0.1' });
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
    const free = await startRunner({ secret: SECRET, port: 0, host: '127.0.0.1' });
    const { port } = free.address();
    await free.close();
    const later = createRemoteRunner({ url: `ws://127.0.0.1:${String(port)}`, secret: SECRET });
    let back: FunctionsRunnerService | undefined;
    setTimeout(() => {
      void startRunner({ secret: SECRET, port, host: '127.0.0.1' }).then(started => {
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
    const free = await startRunner({ secret: SECRET, port: 0, host: '127.0.0.1' });
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
    expect(String(failure)).toContain('unreachable');
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

    try {
      expect(
        await patient.invoke({
          bundle: { id: 'x', load: () => Promise.resolve('') },
          invocation,
          limits: { ...LIMITS, wallMs: 100 },
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
      ).toBe('waited its turn');
    } finally {
      turnTaking.close();
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

  it('takes no invocation short of memory, and the run is over capacity — not the code’s error', async () => {
    const full = await startRunner({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes: 900, limitBytes: 1000 })
    });
    const runner = createRemoteRunner({
      url: `ws://127.0.0.1:${String(full.address().port)}`,
      secret: SECRET,
      waitForRunnerMs: 300
    });

    try {
      const failure = await runner
        .invoke({
          bundle: { id: 'none', load: () => Promise.resolve('') },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
        .catch((error: unknown) => error);

      expect(failure instanceof FunctionFailure && failure.reason).toBe('busy');
      expect(String(failure)).toContain('The functions runner is short of memory');
    } finally {
      await full.close();
    }
  });

  // Memory is read every 100 ms: a burst within one reading is each reserved its share, not all taken on one room.
  it('reserves each invocation it just took its share, so a burst never all lands on one reading', async () => {
    const MIB = 1_048_576;
    // 85 MiB it takes work to, a quarter of 64 MiB kept for each: five at once, the sixth turned away.
    const burst = await startRunner({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readMemory: () => ({ usedBytes: 0, limitBytes: 100 * MIB })
    });
    const runner = createRemoteRunner({
      url: `ws://127.0.0.1:${String(burst.address().port)}`,
      secret: SECRET,
      waitForRunnerMs: 200
    });
    const code = 'export default { tasks: [{ namespace: "probe", action: "run", run: () => "ran" }] };';
    const once = () =>
      runner
        .invoke({
          bundle: { id: 'burst', load: () => Promise.resolve(code) },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
        .catch((error: unknown) => (error instanceof FunctionFailure ? error.reason : error));

    try {
      const answers = await Promise.all(Array.from({ length: 6 }, once));

      expect(answers.filter(answer => answer === 'ran')).toHaveLength(5);
      expect(answers.filter(answer => answer === 'busy')).toHaveLength(1);
    } finally {
      await burst.close();
    }
  });

  it('takes no invocation with its CPU spent: another runner does', async () => {
    const busy = await startRunner({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      readLoad: () => ({ cpuCores: 0.5, cpuShare: 1, lagMs: 300 })
    });
    const runner = createRemoteRunner({
      url: `ws://127.0.0.1:${String(busy.address().port)}`,
      secret: SECRET,
      waitForRunnerMs: 300
    });

    try {
      const failure = await runner
        .invoke({
          bundle: { id: 'none', load: () => Promise.resolve('') },
          invocation,
          limits: LIMITS,
          answer: () => Promise.resolve(null),
          signal: new AbortController().signal
        })
        .catch((error: unknown) => error);

      expect(failure instanceof FunctionFailure && failure.reason).toBe('busy');
      expect(String(failure)).toContain('The functions runner is short of CPU — its CPU is 100% used');
    } finally {
      await busy.close();
    }
  });

  it('spreads its invocations over several runners, and gives a busy one’s to the next', async () => {
    const full = await startRunner({
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
    const stopping = await startRunner({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      runner: slow,
      shutdown: { graceMs: 5000 }
    });
    const url = `ws://127.0.0.1:${String(stopping.address().port)}`;
    const runner = createRemoteRunner({ url, secret: SECRET, waitForRunnerMs: 300 });
    const ask = () =>
      runner.invoke({
        bundle: { id: 'slow', load: () => Promise.resolve('') },
        invocation,
        limits: LIMITS,
        answer: () => Promise.resolve(null),
        signal: new AbortController().signal
      });

    const running = ask();
    await new Promise(resolve => setTimeout(resolve, 100));
    const closed = stopping.close();
    const refused = await ask().catch((error: unknown) => error);
    const health = await fetch(url.replace('ws:', 'http:') + '/health').catch(() => undefined);

    expect(await running).toBe('finished');
    expect(refused instanceof FunctionFailure && refused.reason).toBe('busy');
    expect(String(refused)).toContain('is stopping');
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
    const one = () => startRunner({ secret: SECRET, port: 0, host: '127.0.0.1', concurrency: 1 });
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
    await expect(startRunner({ secret: 'short' })).rejects.toThrow('at least 32 characters');
  });
});
