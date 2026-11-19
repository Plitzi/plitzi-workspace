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
  /**
   * One store two sets of guards can both reach: what a cluster has, and the only way to test that they agree. A key
   * lives until `clock` passes its lifetime, as a shared store's does — and one written without a lifetime, for good.
   */
  const sharedStore = () => {
    const values = new Map<string, string>();
    const expires = new Map<string, number>();
    const clock = { now: 0 };
    const live = (key: string) => {
      const at = expires.get(key);
      if (at !== undefined && at <= clock.now) {
        values.delete(key);
        expires.delete(key);
      }

      return values.get(key);
    };
    const write = (key: string, value: string, ttlSeconds?: number) => {
      values.set(key, value);
      if (ttlSeconds === undefined) {
        expires.delete(key);
      } else {
        expires.set(key, clock.now + ttlSeconds * 1000);
      }
    };

    /** The single-flight keys alone — not who owns a run, nor its cancel or its answer. */
    const runKeys = () => [...values.keys()].filter(key => !/^action:run:(owner|cancel|done):/.test(key));

    return {
      values,
      expires,
      clock,
      runKeys,
      store: {
        get: (key: string) => Promise.resolve(live(key)),
        set: (key: string, value: string, ttlSeconds?: number) => {
          write(key, value, ttlSeconds);

          return Promise.resolve();
        },
        swap: (key: string, expected: string | undefined, next: string, ttlSeconds?: number) => {
          if (live(key) !== expected) {
            return Promise.resolve(false);
          }

          write(key, next, ttlSeconds);

          return Promise.resolve(true);
        },
        delete: (key: string) => {
          values.delete(key);
          expires.delete(key);

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

  // What a job worker claims by: never a job of a space at its ceiling, never past the process's.
  it('says the room it has left: calls it takes, the spaces at their share, and what is spare past a share', async () => {
    const guards = createRunGuards({ perSpace: 2, perProcess: 6 });
    await guards.begin(params({ idempotencyKey: 'a' }));
    await guards.begin(params({ idempotencyKey: 'b' }));
    await guards.begin(params({ spaceId: 2, idempotencyKey: 'c' }));

    // Six a process, three running, a share of two kept free: one spare.
    expect(guards.room()).toEqual({ calls: 3, fullSpaces: [1], spare: 1 });
  });

  // A job worker's run in a spare slot: its space's share does not refuse it, the process's ceiling still does.
  it('starts a run in a spare slot past its space’s share, never past the process’s', async () => {
    const guards = createRunGuards({ perSpace: 1, perProcess: 2 });
    await guards.begin(params({ idempotencyKey: 'a' }));

    await expect(guards.begin(params({ idempotencyKey: 'b' }))).rejects.toThrow('Too many actions');
    await guards.begin(params({ idempotencyKey: 'b', spare: true }));
    await expect(guards.begin(params({ idempotencyKey: 'c', spare: true }))).rejects.toThrow('Too many actions');
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

  // What the pools' screen, narrowed to one environment, reads of a process's slots: production's calls apart from a
  // builder's rehearsals in `main`. A run nobody named an environment for is in the slot's total alone.
  it('says the runs it holds by the environment each is for, and frees them as they end', async () => {
    const guards = createRunGuards({ perSpace: 10 });
    const live = await guards.begin(params({ idempotencyKey: 'a', environment: 'production' }));
    await guards.begin(params({ idempotencyKey: 'b', environment: 'production' }));
    await guards.begin(params({ idempotencyKey: 'c', environment: 'main' }));
    await guards.begin(params({ idempotencyKey: 'd' }));
    await guards.begin({ ...render(1), environment: 'production' });

    expect(guards.slots().calls).toMatchObject({ used: 4, environments: { production: 2, main: 1 } });
    expect(guards.slots().renders).toMatchObject({ used: 1, environments: { production: 1 } });

    await guards.end(live);

    expect(guards.slots().calls).toMatchObject({ used: 3, environments: { production: 1, main: 1 } });
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

  describe('a process short of memory', () => {
    const MB = 1048576;
    const memoryAt = (usedMb: number) => () => ({ usedBytes: usedMb * MB, limitBytes: 1000 * MB });

    // Its slots are free, and still: what the runs in it hold is what would take it down.
    it('starts no new run of either kind, and says it was memory', async () => {
      const guards = createRunGuards({ readMemory: memoryAt(900) });

      await expect(guards.begin(params())).rejects.toMatchObject({ reason: 'over_capacity' });
      await expect(guards.begin(params())).rejects.toThrow('short of memory — 900 of its 1000 MB in use, past the 85%');
      await expect(guards.begin(render(1))).rejects.toMatchObject({ reason: 'over_capacity' });
    });

    it('starts runs again below its share, which a deployment may set', async () => {
      await expect(createRunGuards({ readMemory: memoryAt(800) }).begin(params())).resolves.toBeDefined();
      await expect(
        createRunGuards({ readMemory: memoryAt(800), memoryShare: 0.75 }).begin(params())
      ).rejects.toMatchObject({ reason: 'over_capacity' });
    });
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

    // Taken by `increment` and given its lifetime after, a key whose `expire` never landed (a Redis timing out through a
    // rollout) was kept for good: Meridian's schedules refused as "already running" for twelve hours, nothing running.
    it('takes the key with its lifetime in one write, so a holder that never ends it frees it when that runs out', async () => {
      const { store, expires, clock, runKeys } = sharedStore();
      const crashed = createRunGuards({}, store);
      const next = createRunGuards({}, store);

      const held = await crashed.begin(params({ ttlMs: 10_000 }));
      expect(
        runKeys().map(key => expires.get(key)),
        'the key was written without a lifetime'
      ).toEqual([10_000]);
      await expect(next.begin(params())).rejects.toThrow(/already running/);

      // Its process is gone: nothing ends the run, and only the lifetime frees the key.
      clock.now = 10_001;
      const after = await next.begin(params());
      expect(after.runId).not.toBe(held.runId);
    });

    /** A refusal must not write: a call refused locally that had already taken the shared key would leave every
     *  other replica waiting out a run that never started. */
    it('takes no shared key for a run it refused itself', async () => {
      const { store, runKeys } = sharedStore();
      const guards = createRunGuards({ perSpace: 1 }, store);

      await guards.begin(params({ idempotencyKey: 'a' }));
      await expect(guards.begin(params({ idempotencyKey: 'b' }))).rejects.toThrow(/Too many/);

      expect(runKeys(), 'a refused run left a key behind').toHaveLength(1);
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

    /**
     * The key is a string the CALLER made up, so what it addresses is scoped to them. Without this, a visitor who
     * watched another's request — or simply guessed a key — gets handed the output that run produced.
     */
    it('never replays the answer to a caller who was not the one that ran it', async () => {
      const guards = createRunGuards({}, undefined, { replayTtlMs: 60_000 });
      const run = await guards.begin(params({ idempotencyKey: 'shared-uuid' }));
      await guards.end(run, answer);

      await expect(guards.replay(params({ idempotencyKey: 'shared-uuid' }))).resolves.toEqual(answer);
      await expect(
        guards.replay(params({ idempotencyKey: 'shared-uuid', callerId: 'user:2' }))
      ).resolves.toBeUndefined();
    });

    /** The other caller must not be blocked by it either: a stranger's key is not this caller's single-flight. */
    it('does not let one caller hold the key another caller named', async () => {
      const guards = createRunGuards({}, undefined);
      await guards.begin(params({ idempotencyKey: 'shared-uuid' }));

      await expect(guards.begin(params({ idempotencyKey: 'shared-uuid', callerId: 'user:2' }))).resolves.toBeDefined();
    });

    /**
     * A webhook is the exception, and it is the reason `sharedKey` exists: the delivery id belongs to the sender
     * and was vouched for by the signature, so a retry from another of the provider's addresses is the same
     * delivery rather than a second one.
     */
    it('replays a webhook delivery whatever address it retries from', async () => {
      const guards = createRunGuards({}, undefined, { replayTtlMs: 60_000 });
      const delivery = { idempotencyKey: 'gh-delivery-9', sharedKey: true };
      const run = await guards.begin(params({ ...delivery, callerId: 'ip:1.2.3.4' }));
      await guards.end(run, answer);

      await expect(guards.replay(params({ ...delivery, callerId: 'ip:5.6.7.8' }))).resolves.toEqual(answer);
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
