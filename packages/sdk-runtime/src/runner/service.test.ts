import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { frameText } from '@plitzi/sdk-kernel/http';
import { FUNCTIONS_PROTOCOL, FunctionFailure } from '@plitzi/sdk-shared/functions';

import { invocationFootprintMb, startFunctionsRunnerService } from './service';

import type { FunctionsRunnerService } from './service';
import type { FunctionInvokeRequest, FunctionLimits, FunctionRunner } from '@plitzi/sdk-shared/functions';

/**
 * The runner as a service, held to what it alone decides: who may reach it, one operation per
 * connection, the protocol's versions, the memory it admits by — a visitor's request before work nobody waits on — what
 * it keeps until there is room, and how it stops. The engine behind it is a fake: what runs the code is the isolate's
 * suite.
 */

const SECRET = 'a-runner-secret-of-at-least-32-chars!';
const MB = 1048576;
const LIMITS: FunctionLimits = { cpuMs: 100, wallMs: 1000, memoryMb: 32, outputBytes: 10_000, calls: 10 };

/** An engine whose invocations end when the test says, each with what it was handed. */
const heldEngine = () => {
  const held: { request: FunctionInvokeRequest; end: (value: unknown) => void; fail: (error: unknown) => void }[] = [];
  const engine: FunctionRunner = {
    describe: bundle => Promise.resolve({ described: bundle.id }),
    invoke: request =>
      new Promise((resolve, reject) => {
        held.push({ request, end: resolve, fail: reject });
      })
  };

  return { engine, held };
};

let running: FunctionsRunnerService[] = [];

afterEach(async () => {
  await Promise.all(running.map(service => service.close()));
  running = [];
});

const serve = async (engine: FunctionRunner, { limitMb = 1000, usedMb = 100, memoryShare = 0.85 } = {}) => {
  const service = await startFunctionsRunnerService({
    secret: SECRET,
    port: 0,
    host: '127.0.0.1',
    runner: engine,
    announce: false,
    memoryShare,
    shutdown: { announceMs: 0, graceMs: 200 },
    readMemory: () => ({ usedBytes: usedMb * MB, limitBytes: limitMb * MB })
  });
  running.push(service);

  return `127.0.0.1:${String(service.address().port)}`;
};

type Said = Record<string, unknown> & { type: string };

/** The last thing a connection said, its reason and error read as the words they are. */
const lastOf = (said: Said[]): { type: string; reason: string; error: string } => {
  const last = said.at(-1);

  return {
    type: last?.type ?? '',
    reason: typeof last?.reason === 'string' ? last.reason : '',
    error: typeof last?.error === 'string' ? last.error : ''
  };
};

/** One connection: what it is sent, and every message it answered until it closed. */
const connect = (address: string, secret = SECRET) => {
  const socket = new WebSocket(`ws://${address}`, { headers: { authorization: `Bearer ${secret}` } });
  const said: Said[] = [];
  const waiters: { type: string; found: (message: Said) => void }[] = [];
  socket.on('message', data => {
    const message = JSON.parse(frameText(data)) as Said;
    said.push(message);
    waiters.filter(waiter => waiter.type === message.type).forEach(waiter => waiter.found(message));
  });
  const opened = new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('unexpected-response', (_request, response) =>
      reject(new Error(`HTTP ${String(response.statusCode)}`))
    );
  });
  const closed = new Promise<Said[]>(resolve => socket.once('close', () => resolve(said)));

  return {
    send: async (message: unknown) => {
      await opened;
      socket.send(typeof message === 'string' ? message : JSON.stringify(message));
    },
    next: (type: string) =>
      new Promise<Said>(resolve => {
        const found = said.find(message => message.type === type);
        if (found) {
          resolve(found);
        } else {
          waiters.push({ type, found: resolve });
        }
      }),
    closed,
    close: () => socket.close(),
    opened
  };
};

const invoke = (overrides: { trigger?: string; limits?: FunctionLimits; queue?: boolean; protocol?: string } = {}) => ({
  type: 'invoke',
  protocol: overrides.protocol ?? FUNCTIONS_PROTOCOL,
  bundleId: 'b1',
  invocation: {
    kind: 'task',
    name: 'probe.run',
    params: {},
    context: { spaceId: 1, environment: 'main', runId: 'r', trigger: overrides.trigger ?? 'call', callerId: 'x' }
  },
  limits: overrides.limits ?? LIMITS,
  ...(overrides.queue ? { queue: true } : {})
});

describe('who reaches the runner', () => {
  it('is refused a secret shorter than 32 characters', async () => {
    await expect(startFunctionsRunnerService({ secret: 'short', runner: heldEngine().engine })).rejects.toThrow(
      'The functions runner needs a secret of at least 32 characters'
    );
  });

  it('answers its health to anyone, and its stats and its protocol only with the secret', async () => {
    const address = await serve(heldEngine().engine);

    expect(await (await fetch(`http://${address}/health`)).text()).toBe('ok');
    const refused = await fetch(`http://${address}/_stats`);
    expect([refused.status, ((await refused.json()) as { error: string }).error]).toEqual([
      401,
      "/_stats is read with the runner's secret"
    ]);
    expect((await fetch(`http://${address}/_stats`, { headers: { authorization: `Bearer ${SECRET}` } })).status).toBe(
      200
    );
    const metrics = await fetch(`http://${address}/_stats/metrics`, { headers: { authorization: `Bearer ${SECRET}` } });
    expect([metrics.status, metrics.headers.get('content-type')]).toEqual([
      200,
      'text/plain; version=0.0.4; charset=utf-8'
    ]);
    expect(await metrics.text()).toMatch(
      /^plitzi_process_health\{pool="runner",process="[^"]+",status="healthy"\} 1$/m
    );
    expect((await fetch(`http://${address}/_stats/metrics`)).status).toBe(401);
    await expect(connect(address, 'not-the-secret-not-the-secret-not').opened).rejects.toThrow('HTTP 401');
  });
});

describe('one connection', () => {
  it('runs one invocation, asks for a bundle it is not handed, and carries each call back on the same socket', async () => {
    const { engine, held } = heldEngine();
    const client = connect(await serve(engine));
    await client.send(invoke());
    await client.next('accepted');

    const [running] = held;
    const loaded = running.request.bundle.load();
    await client.next('needBundle');
    await client.send({ type: 'bundle', bundle: { id: 'b1', code: 'the code' } });
    expect(await loaded).toBe('the code');

    const answered = running.request.answer({ op: 'kv' });
    const call = await client.next('call');
    expect(call.call).toEqual({ op: 'kv' });
    await client.send({ type: 'answer', id: call.id, answer: { ok: true, value: 7 } });
    expect(await answered).toBe(7);

    running.end('finished');

    expect((await client.closed).at(-1)).toEqual({ type: 'done', value: 'finished' });
  });

  it('takes one operation, and refuses a second on the same connection', async () => {
    const client = connect(await serve(heldEngine().engine));
    await client.send(invoke());
    await client.next('accepted');
    await client.send(invoke());

    expect((await client.closed).at(-1)).toEqual({
      type: 'failed',
      reason: 'error',
      error: 'One operation per connection'
    });
  });

  it('refuses what is not the protocol, and a version it does not know, naming which side to upgrade', async () => {
    const address = await serve(heldEngine().engine);
    const garbled = connect(address);
    await garbled.send('{"type":"invoke"}');
    const newer = connect(address);
    await newer.send(invoke({ protocol: '2.0' }));

    expect((await garbled.closed).at(-1)).toMatchObject({ error: 'Not a message of the functions protocol' });
    const newerSaid = lastOf(await newer.closed);

    expect(newerSaid).toMatchObject({ reason: 'error' });
    expect(newerSaid.error).toContain('Upgrade the runner');
  });

  it("says the engine's failure with its reason, and a thrown error as the code's", async () => {
    const { engine, held } = heldEngine();
    const address = await serve(engine);
    const stopped = connect(address);
    await stopped.send(invoke());
    await stopped.next('accepted');
    held[0].fail(new FunctionFailure('cpu', 'Stopped after 100 ms of CPU'));
    const thrown = connect(address);
    await thrown.send(invoke());
    await thrown.next('accepted');
    held[1].fail(new Error('no feed today'));

    expect((await stopped.closed).at(-1)).toEqual({
      type: 'failed',
      reason: 'cpu',
      error: 'Stopped after 100 ms of CPU'
    });
    expect((await thrown.closed).at(-1)).toEqual({ type: 'failed', reason: 'error', error: 'no feed today' });
  });

  it('aborts the invocation when the platform goes away, and its calls are answered that it did', async () => {
    const { engine, held } = heldEngine();
    const client = connect(await serve(engine));
    await client.send(invoke());
    await client.next('accepted');
    const answered = held[0].request.answer({ op: 'kv' });
    await client.next('call');

    client.close();

    await expect(answered).rejects.toThrow('The platform went away');
    expect(held[0].request.signal.aborted).toBe(true);
  });
});

describe('what it admits', () => {
  it('reserves each invocation whole, and turns away the one past its share of memory', async () => {
    // 170 MB to admit by, 100 held idle: one small invocation (44 MB whole) fits, a second does not.
    const { engine } = heldEngine();
    const address = await serve(engine, { limitMb: 200 });
    const first = connect(address);
    await first.send(invoke());
    await first.next('accepted');
    const second = connect(address);
    await second.send(invoke());

    expect(invocationFootprintMb(32)).toBe(44);
    const secondSaid = lastOf(await second.closed);

    expect(secondSaid).toMatchObject({ type: 'failed', reason: 'busy' });
    expect(secondSaid.error).toContain('The functions runner is short of memory');
  });

  it('keeps room for a visitor: work nobody waits on takes three quarters of it once something runs', async () => {
    // 255 MB to admit by, 100 idle: two invocations hold 188; a third, 44 more, fits the whole room (255) and not the
    // background's (100 + 155 × 0.75).
    const { engine } = heldEngine();
    const address = await serve(engine, { limitMb: 300 });
    for (let held = 0; held < 2; held++) {
      const holding = connect(address);
      await holding.send(invoke());
      await holding.next('accepted');
    }
    const scheduled = connect(address);
    await scheduled.send(invoke({ trigger: 'schedule' }));
    const visitor = connect(address);
    await visitor.send(invoke());

    const scheduledSaid = lastOf(await scheduled.closed);

    expect(scheduledSaid).toMatchObject({ reason: 'busy' });
    expect(scheduledSaid.error).toContain("the rest kept for visitors' requests");
    expect(await visitor.next('accepted')).toEqual({ type: 'accepted' });
  });

  it('says at once what it could never hold, as too large to a platform that knows it and as busy to one that does not', async () => {
    const address = await serve(heldEngine().engine);
    const huge = { ...LIMITS, memoryMb: 1024 };
    const current = connect(address);
    await current.send(invoke({ limits: huge }));
    const older = connect(address);
    await older.send(invoke({ limits: huge, protocol: '1.3' }));

    const currentSaid = lastOf(await current.closed);

    expect(currentSaid).toMatchObject({ reason: 'too_large' });
    expect(currentSaid.error).toContain('This functions runner could never hold it');
    expect((await older.closed).at(-1)).toMatchObject({ reason: 'busy' });
  });

  it('keeps what it has no room for when asked to, and lets it in as one ends', async () => {
    const { engine, held } = heldEngine();
    const address = await serve(engine, { limitMb: 200 });
    const first = connect(address);
    await first.send(invoke());
    await first.next('accepted');
    const kept = connect(address);
    await kept.send(invoke({ queue: true }));
    await kept.next('queued');

    held[0].end('first');

    expect(await kept.next('accepted')).toEqual({ type: 'accepted' });
  });
});

describe('how it stops', () => {
  it('answers its health as stopping, and gives what it kept to another runner, while it finishes what it runs', async () => {
    const { engine, held } = heldEngine();
    const service = await startFunctionsRunnerService({
      secret: SECRET,
      port: 0,
      host: '127.0.0.1',
      runner: engine,
      announce: false,
      shutdown: { announceMs: 300, graceMs: 2000 },
      readMemory: () => ({ usedBytes: 100 * MB, limitBytes: 200 * MB })
    });
    const address = `127.0.0.1:${String(service.address().port)}`;
    const first = connect(address);
    await first.send(invoke());
    await first.next('accepted');
    const kept = connect(address);
    await kept.send(invoke({ queue: true }));
    await kept.next('queued');

    const closing = service.close();
    const health = await fetch(`http://${address}/health`);

    expect([health.status, await health.text()]).toEqual([503, 'stopping']);
    const keptSaid = lastOf(await kept.closed);

    expect(keptSaid).toMatchObject({ reason: 'busy' });
    expect(keptSaid.error).toContain('started stopping while it kept the invocation');
    held[0].end('finished in time');
    expect((await first.closed).at(-1)).toEqual({ type: 'done', value: 'finished in time' });
    await closing;
  });
});
