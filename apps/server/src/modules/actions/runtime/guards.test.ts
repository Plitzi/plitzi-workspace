import { describe, expect, it } from 'vitest';

import { createRunGuards, runCancelKey } from './guards';

import type { BeginRunParams } from './guards';

const params = (overrides: Partial<BeginRunParams> = {}): BeginRunParams => ({
  spaceId: 1,
  actionId: 'quote',
  callerId: 'user:1',
  input: {},
  ttlMs: 10_000,
  ...overrides
});

/** A render carries its own key — two visitors are not one caller submitting twice — so these fixtures do too. */
const render = (n: number, spaceId = 1): BeginRunParams =>
  params({ spaceId, kind: 'render', callerId: 'render', idempotencyKey: `render:${n}` });

describe('createRunGuards', () => {
  /** One store two sets of guards can both reach: what a cluster has, and the only way to test that they agree. */
  const sharedStore = () => {
    const counters = new Map<string, number>();
    const values = new Map<string, string>();

    return {
      counters,
      values,
      store: {
        get: (key: string) => Promise.resolve(values.get(key)),
        set: (key: string, value: string) => {
          values.set(key, value);

          return Promise.resolve();
        },
        increment: (key: string, amount: number) => {
          const next = (counters.get(key) ?? 0) + amount;
          counters.set(key, next);

          return Promise.resolve(next);
        },
        expire: () => Promise.resolve(),
        delete: (key: string) => {
          counters.delete(key);
          values.delete(key);

          return Promise.resolve();
        }
      }
    };
  };

  it('refuses a second live run under the same key', async () => {
    const guards = createRunGuards();
    await guards.begin(params());

    await expect(guards.begin(params())).rejects.toThrow(/already running/);
  });

  /** The local slot is taken before anything is awaited: two callers in the same process cannot both pass the
   *  check, however many turns of the event loop the shared half costs. */
  it('refuses a second run that starts while the first is still being admitted', async () => {
    const guards = createRunGuards();

    const [first, second] = await Promise.allSettled([guards.begin(params()), guards.begin(params())]);

    expect([first.status, second.status].sort()).toEqual(['fulfilled', 'rejected']);
  });

  it('counts calls against their space', async () => {
    const guards = createRunGuards({ perSpace: 2 });
    await guards.begin(params({ idempotencyKey: 'a' }));
    await guards.begin(params({ idempotencyKey: 'b' }));

    await expect(guards.begin(params({ idempotencyKey: 'c' }))).rejects.toThrow(/Too many/);
    // Another space is unaffected: the ceiling is what keeps one space's callers off everyone else's server.
    await expect(guards.begin(params({ spaceId: 2, idempotencyKey: 'd' }))).resolves.toBeDefined();
  });

  /**
   * The rule this file exists for.
   *
   * A render arrives because somebody is READING the page, so the number in flight is the number of visitors —
   * five hundred at once is a page doing well, not a space abusing anything. Counted against the per-space call
   * budget, a popular page refused its own visitors' sections one by one.
   */
  it('does not count renders against the space budget', async () => {
    const guards = createRunGuards({ perSpace: 1 });
    await guards.begin(params({ idempotencyKey: 'the-one-call' }));

    for (let n = 0; n < 50; n += 1) {
      await expect(guards.begin(render(n))).resolves.toBeDefined();
    }
  });

  it('still holds renders to what the process will carry', async () => {
    const guards = createRunGuards({ renderPerProcess: 2 });
    await guards.begin(render(1));
    await guards.begin(render(2));

    await expect(guards.begin(render(3))).rejects.toThrow(/Too many/);
  });

  /** Two budgets, so a page under load cannot spend the one calls draw on — nor be refused because calls did. */
  it('keeps the two budgets apart', async () => {
    const guards = createRunGuards({ perProcess: 1, renderPerProcess: 1 });
    await guards.begin(params({ idempotencyKey: 'call' }));

    await expect(guards.begin(render(1))).resolves.toBeDefined();
    await expect(guards.begin(params({ spaceId: 9, idempotencyKey: 'second-call' }))).rejects.toThrow(/Too many/);
  });

  it('frees the slot when the run ends', async () => {
    const guards = createRunGuards({ renderPerProcess: 1 });
    const run = await guards.begin(render(1));
    await guards.end(run);

    await expect(guards.begin(render(2))).resolves.toBeDefined();
  });

  /**
   * Two replicas, one store: the same double-click reaching each of them is one run, not two.
   *
   * Per process it is not a guarantee at all — behind a load balancer the second submit simply lands somewhere
   * else — so this is the half that has to be shared, and the only atomic primitive the adapter contract offers
   * is what takes the key.
   */
  describe('with a shared store', () => {
    it('refuses a run another replica is already holding', async () => {
      const { store } = sharedStore();
      const first = createRunGuards({}, store);
      const second = createRunGuards({}, store);

      await first.begin(params());

      await expect(second.begin(params())).rejects.toThrow(/already running/);
    });

    it('hands the key over as soon as the run ends', async () => {
      const { store } = sharedStore();
      const first = createRunGuards({}, store);
      const second = createRunGuards({}, store);

      const run = await first.begin(params());
      await first.end(run);

      await expect(second.begin(params())).resolves.toBeDefined();
    });

    /** A refusal must not write: a call refused locally that had already taken the shared key would leave every
     *  other replica waiting out a run that never started. */
    it('takes no shared key for a run it refused itself', async () => {
      const { store, counters } = sharedStore();
      const guards = createRunGuards({ perSpace: 1 }, store);

      await guards.begin(params({ idempotencyKey: 'a' }));
      await expect(guards.begin(params({ idempotencyKey: 'b' }))).rejects.toThrow(/Too many/);

      expect(counters.size, 'a refused run left a key behind').toBe(1);
    });

    /**
     * The case the whole cancel mechanism exists for: behind a load balancer, the request asking to stop a run
     * almost never lands on the replica running it.
     */
    it('carries a cancel to the replica that is actually running the flow', async () => {
      const { store, values } = sharedStore();
      const running = createRunGuards({}, store);
      const asked = createRunGuards({}, store);

      const run = await running.begin(params());

      expect(await asked.cancel(run.runId, 'user:1'), 'the other replica refused to pass it on').toBe(true);
      expect(values.get(runCancelKey(run.runId)), 'nothing was left for the running replica to read').toBe('1');
    });

    /** A run id travels to the browser. Holding one must not let anybody stop somebody else's checkout — and that
     *  has to hold on the replica that has never heard of the run, which is most of them. */
    it('refuses a cancel from someone who did not start the run, from any replica', async () => {
      const { store } = sharedStore();
      const running = createRunGuards({}, store);
      const asked = createRunGuards({}, store);

      const run = await running.begin(params());

      expect(await asked.cancel(run.runId, 'user:2')).toBe(false);
      expect(await running.cancel(run.runId, 'user:2')).toBe(false);
      expect(run.controller.signal.aborted).toBe(false);
    });
  });

  /**
   * Single-flight covers the retry that OVERLAPS the first run. This covers the one that arrives after it
   * finished, which is how every webhook provider actually retries.
   */
  describe('replaying a finished run', () => {
    const answer = { runId: 'run-1', status: 'completed' as const, output: { ok: true } };

    it('answers a repeat of the same named key with what the first run returned', async () => {
      const guards = createRunGuards({}, undefined, { replayTtlMs: 60_000 });
      const run = await guards.begin(params({ idempotencyKey: 'delivery-1' }));
      await guards.end(run, answer);

      await expect(guards.replay(params({ idempotencyKey: 'delivery-1' }))).resolves.toEqual(answer);
    });

    /** A derived key is a hash of the input: two identical calls a minute apart are usually two things somebody
     *  meant to happen twice, and answering the second from a cache would silently drop one of them. */
    it('never replays a key the caller did not name', async () => {
      const guards = createRunGuards({}, undefined, { replayTtlMs: 60_000 });
      const run = await guards.begin(params());
      await guards.end(run, answer);

      await expect(guards.replay(params())).resolves.toBeUndefined();
    });

    /** Retrying after a failure is the reasonable thing to do. Pinning a transient outage for the whole window
     *  would turn a blip into an hour of one. */
    it('never replays a run that did not complete', async () => {
      const guards = createRunGuards({}, undefined, { replayTtlMs: 60_000 });
      const run = await guards.begin(params({ idempotencyKey: 'delivery-2' }));
      await guards.end(run, { ...answer, status: 'failed' });

      await expect(guards.replay(params({ idempotencyKey: 'delivery-2' }))).resolves.toBeUndefined();
    });

    it('is off until a deployment sets a window', async () => {
      const guards = createRunGuards();
      const run = await guards.begin(params({ idempotencyKey: 'delivery-3' }));
      await guards.end(run, answer);

      await expect(guards.replay(params({ idempotencyKey: 'delivery-3' }))).resolves.toBeUndefined();
    });

    it('replays across replicas when they share a store', async () => {
      const { store } = sharedStore();
      const first = createRunGuards({}, store, { replayTtlMs: 60_000 });
      const second = createRunGuards({}, store, { replayTtlMs: 60_000 });

      const run = await first.begin(params({ idempotencyKey: 'delivery-4' }));
      await first.end(run, answer);

      await expect(second.replay(params({ idempotencyKey: 'delivery-4' }))).resolves.toEqual(answer);
    });

    /** The trace is the author's own data and can be large; a replay owes the caller what the call returned. */
    it('keeps the answer and not the trace', async () => {
      const { store, values } = sharedStore();
      const guards = createRunGuards({}, store, { replayTtlMs: 60_000 });

      const run = await guards.begin(params({ idempotencyKey: 'delivery-5' }));
      await guards.end(run, { ...answer, trace: [{ secret: 'do not keep me' }] } as never);

      expect([...values.values()].join(' ')).not.toContain('do not keep me');
    });
  });
});
