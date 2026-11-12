import { describe, expect, it, vi } from 'vitest';

import { changeKv, changeListEntry } from '@plitzi/sdk-shared/functions';

import { createFunctionsDriver, describeFunctions } from './driver';

/**
 * The one driver there is — the sandbox's guest runs its source, a space runtime imports it — held to what it alone
 * decides: what a definition declares, which code an invocation reaches, what `ctx` sends the platform
 * and reads back from it, and why a job's slice is asked to end.
 */

type Sent = Record<string, unknown>;

const driverWith = ({
  answer = () => Promise.resolve(null),
  signal = new AbortController().signal
}: { answer?: (message: Sent) => Promise<unknown>; signal?: unknown } = {}) => {
  const sent: Sent[] = [];
  const driver = createFunctionsDriver({
    call: message => {
      sent.push(message);

      return answer(message);
    },
    signal,
    responseOf: wire => ({ response: wire }),
    requestOf: wire => ({ request: wire }),
    wireOfResponse: response =>
      Promise.resolve(
        typeof response === 'object' && response !== null && 'status' in response
          ? { status: response.status }
          : undefined
      ),
    changeKv,
    changeListEntry,
    refusal: message => Object.assign(new Error(message), { name: 'Refusal' })
  });

  return { driver, sent };
};

/** A definition of one task, `probe.run`, that hands its `ctx` to `use` and answers what it answers. */
const taskOf = (use: (params: Record<string, unknown>, ctx: Record<string, unknown>) => unknown) => ({
  tasks: [{ namespace: 'probe', action: 'run', run: use }]
});

const task = (params: Record<string, unknown> = {}) => ({
  kind: 'task',
  name: 'probe.run',
  params,
  context: { spaceId: 3 }
});

/** `ctx` as the code is handed it: a record of the platform's methods, whatever the definition declared. */
const ctxOf = async (driver: ReturnType<typeof createFunctionsDriver>): Promise<Record<string, unknown>> => {
  let found: Record<string, unknown> = {};
  await driver.invoke(
    taskOf((_params, ctx) => {
      found = ctx;
    }),
    task()
  );

  return found;
};

describe('what a definition declares', () => {
  it('is read field by field, its code left in the bundle', () => {
    const run = () => 1;

    expect(
      describeFunctions({
        allow: { hosts: ['api.example.com'] },
        tasks: [{ namespace: 'a', action: 'b', title: 'T', params: {}, limits: { cpuMs: 5 }, run }, 'not a task'],
        routes: { 'GET /x': run },
        jobs: { sync: { watch: true, maxSeconds: 30, run } },
        limits: { calls: 5 }
      })
    ).toEqual({
      hosts: ['api.example.com'],
      tasks: [
        { namespace: 'a', action: 'b', title: 'T', description: undefined, params: {}, limits: { cpuMs: 5 } },
        {}
      ],
      routes: ['GET /x'],
      limits: { calls: 5 },
      oauth: undefined,
      jobs: { sync: { watch: true, maxSeconds: 30 } }
    });
  });

  it('is empty for what declares nothing', () => {
    expect(describeFunctions(null)).toMatchObject({ hosts: [], tasks: [], routes: [] });
  });
});

describe('an invocation', () => {
  it("runs the task it names with its params, and answers null for the code's nothing", async () => {
    const { driver } = driverWith();

    expect(
      await driver.invoke(
        taskOf(params => params.n),
        task({ n: 2 })
      )
    ).toBe(2);
    expect(
      await driver.invoke(
        taskOf(() => undefined),
        task()
      )
    ).toBeNull();
    await expect(
      driver.invoke(
        taskOf(() => 1),
        { kind: 'task', name: 'other.run' }
      )
    ).rejects.toThrow(`This space's functions have no task "other.run"`);
  });

  it("hands the code the invocation's facts in its ctx", async () => {
    expect((await ctxOf(driverWith().driver)).spaceId).toBe(3);
  });

  it("runs a route with its request and params, and refuses an answer that is not this environment's Response", async () => {
    const { driver } = driverWith();
    const routes = {
      'GET /ok': (request: unknown, ctx: { params: unknown }) => ({ status: 201, request, params: ctx.params }),
      'GET /odd': () => 'text'
    };

    expect(
      await driver.invoke({ routes }, { kind: 'route', key: 'GET /ok', request: { url: '/ok' }, params: { id: '1' } })
    ).toEqual({ status: 201 });
    await expect(driver.invoke({ routes }, { kind: 'route', key: 'GET /odd' })).rejects.toThrow(
      'Route "GET /odd" answered something that is not a Response'
    );
    await expect(driver.invoke({ routes }, { kind: 'route', key: 'POST /none' })).rejects.toThrow(
      `This space's functions have no route "POST /none"`
    );
  });

  it("runs a job's slice with its handle, and refuses a job it does not have", async () => {
    const { driver, sent } = driverWith();
    const jobs = {
      sync: {
        run: async (input: unknown, job: { id: unknown; state: unknown; save: (state: unknown) => Promise<void> }) => {
          await job.save({ at: 2 });

          return { input, id: job.id, state: job.state };
        }
      }
    };

    expect(
      await driver.invoke(
        { jobs },
        { kind: 'job', name: 'sync', input: { a: 1 }, job: { id: 'j1', state: { at: 1 }, attempt: 1 } }
      )
    ).toEqual({ input: { a: 1 }, id: 'j1', state: { at: 1 } });
    expect(sent).toContainEqual({ op: 'job', method: 'save', state: { at: 2 } });
    await expect(driver.invoke({ jobs }, { kind: 'job', name: 'toString' })).rejects.toThrow(
      `This space's functions have no job "toString"`
    );
  });
});

describe("why a job's slice is asked to end", () => {
  const stoppingWith = async (signal: unknown): Promise<unknown> => {
    let stopping: unknown = 'unread';
    await driverWith({ signal }).driver.invoke(
      {
        jobs: {
          sync: {
            run: (_input: unknown, job: { stopping: unknown }) => {
              stopping = job.stopping;
            }
          }
        }
      },
      { kind: 'job', name: 'sync' }
    );

    return stopping;
  };
  const abortedWith = (reason: unknown): AbortSignal => {
    const controller = new AbortController();
    controller.abort(reason);

    return controller.signal;
  };

  it('is nothing while its signal has not fired', async () => {
    expect(await stoppingWith(new AbortController().signal)).toBeUndefined();
  });

  it('is the reason the signal fired with, as itself or as an error’s message', async () => {
    expect(await stoppingWith(abortedWith('pause'))).toBe('pause');
    expect(await stoppingWith(abortedWith(new Error('limit')))).toBe('limit');
  });

  it('is a cancel when the signal said none of the reasons', async () => {
    expect(await stoppingWith(abortedWith('because'))).toBe('cancel');
  });
});

describe('what ctx sends, and what it reads back', () => {
  it('fetches through the platform, its signal kept on this side', async () => {
    const { driver, sent } = driverWith({ answer: () => Promise.resolve({ status: 200 }) });
    const ctx = (await ctxOf(driver)) as { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };

    expect(
      await ctx.fetch('https://api.example.com/', { method: 'POST', signal: new AbortController().signal })
    ).toEqual({ response: { status: 200 } });
    expect(sent.at(-1)).toEqual({ op: 'fetch', url: 'https://api.example.com/', init: { method: 'POST' }, request: 1 });
  });

  it('refuses a signal that is no AbortSignal, and one already aborted, without calling', async () => {
    const { driver, sent } = driverWith();
    const ctx = (await ctxOf(driver)) as { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
    const aborted = new AbortController();
    aborted.abort();

    await expect(ctx.fetch('https://a.example.com/', { signal: 'soon' })).rejects.toThrow(
      'The signal of a request is an AbortSignal'
    );
    await expect(ctx.fetch('https://a.example.com/', { signal: aborted.signal })).rejects.toMatchObject({
      name: 'AbortError'
    });
    expect(sent.filter(message => message.op === 'fetch')).toEqual([]);
  });

  it('stops waiting when the signal fires, and tells the platform which request to cut', async () => {
    const { driver, sent } = driverWith({
      answer: message => (message.op === 'fetch' ? new Promise(() => undefined) : Promise.resolve(null))
    });
    const ctx = (await ctxOf(driver)) as { fetch: (url: string, init?: Record<string, unknown>) => Promise<unknown> };
    const controller = new AbortController();
    const pending = ctx.fetch('https://a.example.com/', { signal: controller.signal });

    controller.abort(new Error('enough'));

    await expect(pending).rejects.toThrow('enough');
    expect(sent.at(-1)).toEqual({ op: 'abort', request: 1 });
  });

  it("refuses past a rate limit in the code's words, and counts when it gave none", async () => {
    const { driver } = driverWith({ answer: () => Promise.resolve({ allowed: false, count: 6 }) });
    const ctx = (await ctxOf(driver)) as { rateLimit: (bucket: string, limit: unknown) => Promise<unknown> };

    await expect(ctx.rateLimit('b', { max: 5, refuse: 'Slow down' })).rejects.toMatchObject({
      name: 'Refusal',
      message: 'Slow down'
    });
    expect(await ctx.rateLimit('b', { max: 5 })).toEqual({ allowed: false, count: 6 });
  });

  it('reads a visitor as its public fields alone, and presence as the members it can read', async () => {
    const { driver } = driverWith({
      answer: message =>
        Promise.resolve(
          message.op === 'visitor'
            ? { id: 7, username: 'ana', email: 'ana@example.com', name: 'Ana' }
            : { members: [{ from: 'a', since: 1, user: { id: 7, name: 'Ana', email: 'x' } }, { from: 'b' }, 'c'] }
        )
    });
    const ctx = (await ctxOf(driver)) as {
      visitors: { get: (who: number) => Promise<unknown> };
      presence: (topic: string) => Promise<unknown>;
    };

    expect(await ctx.visitors.get(7)).toEqual({ id: 7, username: 'ana', name: 'Ana' });
    expect(await ctx.presence('room')).toEqual({
      count: 1,
      members: [{ from: 'a', since: 1, user: { id: 7, name: 'Ana' } }]
    });
  });

  it('answers a swap as written or not, and a job it does not find as nothing', async () => {
    const { driver, sent } = driverWith({ answer: message => Promise.resolve(message.op === 'kv' ? 'yes' : null) });
    const ctx = (await ctxOf(driver)) as {
      kv: { swap: (...args: unknown[]) => Promise<boolean>; listSwap: (...args: unknown[]) => Promise<boolean> };
      jobs: { get: (id: string) => Promise<unknown> };
    };

    expect(await ctx.kv.swap('k', 1, 2)).toBe(false);
    expect(await ctx.kv.listSwap('l', 'id', undefined, 2)).toBe(false);
    expect(sent.at(-1)).toEqual({ op: 'kv', method: 'listSwap', args: ['l', 'id', null, 2] });
    expect(await ctx.jobs.get('j')).toBeUndefined();
  });

  it('logs every value as the wire carries it, and never fails the code when the line is lost', async () => {
    const answer = vi.fn(() => Promise.reject(new Error('lost')));
    const { driver, sent } = driverWith({ answer });

    driver.log('a', new TypeError('bad'), undefined, () => 1, 2n, { n: 1 });
    await Promise.resolve();

    expect(sent.at(-1)).toEqual({
      op: 'log',
      values: ['a', 'TypeError: bad', 'undefined', 'function', 'bigint', { n: 1 }]
    });
  });
});
