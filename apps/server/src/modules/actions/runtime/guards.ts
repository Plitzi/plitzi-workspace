import { createHash, randomUUID } from 'node:crypto';

import { ActionRunError } from './errors';

import type { ActionCallResult } from '@plitzi/sdk-shared';

/**
 * Which budget a run draws on.
 *
 * `call` is somebody ASKING for work — a click, a webhook, a schedule — and one space's callers hammering is a
 * problem that belongs to that space. `render` is somebody LOOKING at a page, which is traffic: it scales with
 * how popular the space is, and a ceiling per space would cap a successful page rather than an abusive one.
 */
export type RunKind = 'call' | 'render';

/** A run currently holding a slot, and the handle that can stop it. */
export type ActiveRun = {
  runId: string;
  runKey: string;
  kind: RunKind;
  spaceId: number;
  actionId: string;
  callerId: string;
  controller: AbortController;
  expiresAt: number;
  /**
   * Whether the caller NAMED this run's key rather than having it derived from what they sent.
   *
   * It is what decides whether the answer may be replayed: a sender that stamps a delivery id is telling us which
   * request this is, so answering the retry with the first result is exactly right. A derived key is a hash of
   * the input, and two identical calls a minute apart are usually two things somebody meant to happen twice.
   */
  explicitKey: boolean;
};

/**
 * The half of a key/value store the guards need, and nothing more.
 *
 * The same methods `ActionKvAdapter` already declares, so a deployment that configured `action.kv` has already
 * provided this: no second store to stand up, and no adapter change. `increment` is what takes a single-flight
 * key; `get`/`set` are what carry a cancellation and a replayable answer between replicas.
 */
export type RunKeyStore = {
  get: (key: string) => Promise<string | undefined>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
  increment: (key: string, amount: number) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

export type RunGuardsConfig = {
  /** Concurrent CALLS one space may have in flight. Renders are not counted here — see {@link RunKind}. */
  perSpace?: number;
  /** Concurrent calls this process will carry, across every space. */
  perProcess?: number;
  /**
   * Concurrent RENDERS this process will carry, across every space — the only ceiling renders have.
   *
   * What a render threatens is the box, never the space it belongs to: five hundred people reading one page at
   * once is that page working. So this is sized for a machine, and it is the number a deployment tunes when it
   * knows its own — the default is deliberately generous, and each slot is held for at most one run's timeout.
   */
  renderPerProcess?: number;
};

export type BeginRunParams = {
  spaceId: number;
  actionId: string;
  callerId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  /**
   * The key names the WORK, not who asked.
   *
   * True only for a webhook, where the key is the SENDER's delivery id and the signature that let the request in
   * is what authenticated it: the same delivery retried from another of a provider's addresses is the same
   * delivery, and scoping it per caller would run it twice.
   *
   * Everywhere else the key is a string the caller made up, so it is scoped to them. Without that, a visitor who
   * learns or guesses another's key collides with their single-flight and — where a deployment set a replay
   * window — is handed the answer their run produced.
   */
  sharedKey?: boolean;
  ttlMs: number;
  /** Which budget this run draws on. Defaults to `call`: a trigger that says nothing is somebody asking. */
  kind?: RunKind;
};

/** What a deployment may set about replaying a finished run. Off unless it says otherwise. */
export type RunIdempotency = { replayTtlMs?: number };

export type RunGuards = {
  begin: (params: BeginRunParams) => Promise<ActiveRun>;
  /** Releases the key, and — for a run the caller keyed itself — remembers the answer for {@link RunIdempotency}. */
  end: (run: ActiveRun, outcome?: ActionCallResult) => Promise<void>;
  get: (runId: string) => ActiveRun | undefined;
  /** The answer a run with this key already produced, when it is still within the replay window. */
  replay: (params: BeginRunParams) => Promise<ActionCallResult | undefined>;
  /** Stops a run: here if this process holds it, and through the store if another one does. */
  cancel: (runId: string, callerId: string) => Promise<boolean>;
  active: () => number;
};

const DEFAULTS = { perSpace: 10, perProcess: 100, renderPerProcess: 1000 };

/**
 * How long a cancellation waits to be read, when the replica that owns the run is not the one that took the
 * request.
 *
 * Longer than any run's own timeout would be pointless — the run it addresses is gone — and shorter risks a flag
 * expiring before a slow step finishes. A streaming run's ceiling is two minutes, so this covers it with room.
 */
const CANCEL_FLAG_TTL_SECONDS = 180;

/** Kept away from the `kv` tasks' own prefix: a flow writing `run:…` must not be able to release a run. */
const keyPrefix = 'action:run:';

/**
 * Where a cancellation is left for whichever replica is actually running the flow.
 *
 * Exported because the RUNNER is what reads it, at every step boundary, and the two must not each spell the key
 * their own way — a cancel written under one name and read under another is a stop button that does nothing.
 */
export const runCancelKey = (runId: string): string => `${keyPrefix}cancel:${runId}`;

/** Who started a run, so a cancel arriving at another replica can still check ownership. */
const runOwnerKey = (runId: string): string => `${keyPrefix}owner:${runId}`;

/** The answer a finished run left behind, for a caller that asks again with the same key. */
const runResultKey = (runKey: string): string => `${keyPrefix}done:${runKey}`;

/** Stable regardless of key order, so the same call from the same caller derives the same key every time. */
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }

  // `JSON.stringify(undefined)` answers undefined, which the lib types as string — spell the case out rather
  // than leaning on a coalesce the type checker believes is dead.
  if (value === undefined) {
    return 'null';
  }

  return JSON.stringify(value);
};

export const deriveRunKey = ({
  spaceId,
  actionId,
  callerId,
  input,
  idempotencyKey,
  sharedKey
}: BeginRunParams): string => {
  if (idempotencyKey) {
    return sharedKey
      ? `${spaceId}:${actionId}:${idempotencyKey}`
      : `${spaceId}:${actionId}:${callerId}:${idempotencyKey}`;
  }

  const digest = createHash('sha256').update(canonical({ callerId, input })).digest('hex').slice(0, 32);

  return `${spaceId}:${actionId}:${digest}`;
};

/**
 * Single-flight, concurrency caps and cancellation, in one place.
 *
 * The client engine already refuses re-entry — `InteractionsManager` drops a trigger that fires while its own flow
 * is still running — and this is the same rule keyed by what identifies a RUN rather than a DOM event. Without it
 * a client that retries, reconnects or simply double-clicks turns one intent into many runs, and a streaming
 * caller can turn it into an unbounded loop.
 *
 * **What is shared and what is not**, when a store is handed over:
 *
 * - **Single-flight is**, because per replica it is not a guarantee at all: the same double-click behind a load
 *   balancer lands on two of them and both run. The key is taken with `increment`, which is the one atomic
 *   test-and-set every adapter already has to provide — the holder is whoever's increment answered `1` — and it
 *   carries the run's own timeout as its lifetime, so a replica that dies holding one frees it by expiring.
 * - **The caps are not.** Counting them across replicas needs a decrementing counter, and a run that dies without
 *   decrementing throttles a healthy space until somebody notices. A ceiling that is per replica is a number a
 *   deployment can multiply and reason about; one that leaks is not. So `perSpace` is per replica, deliberately,
 *   and a cluster's real ceiling is that times the number of them.
 * - **Cancellation is**, in one direction. Only the process running a flow holds the `AbortController` that stops
 *   it, so a `DELETE` that lands anywhere else leaves a FLAG in the store and the run reads it at its next step
 *   boundary. Behind a load balancer that is the normal case rather than the exotic one: the tab that wants to
 *   stop a checkout almost never reaches the replica running it.
 * - **A finished answer is**, when the caller named the key and the deployment set a replay window.
 */
export const createRunGuards = (
  config: RunGuardsConfig = {},
  store?: RunKeyStore,
  idempotency: RunIdempotency = {}
): RunGuards => {
  const perSpace = config.perSpace ?? DEFAULTS.perSpace;
  const perProcess = config.perProcess ?? DEFAULTS.perProcess;
  const renderPerProcess = config.renderPerProcess ?? DEFAULTS.renderPerProcess;
  const replayTtlMs = idempotency.replayTtlMs ?? 0;
  const byKey = new Map<string, ActiveRun>();
  const byId = new Map<string, ActiveRun>();
  /** The no-store half of replay: one process remembering its own answers, which is what one process can honestly
   *  offer. With a store it is never read — a cluster's replays have to be everybody's. */
  const localResults = new Map<string, { expiresAt: number; result: ActionCallResult }>();

  // A run whose handler died without releasing would otherwise hold its key forever, and the symptom is an action
  // that answers 409 until the process restarts.
  const sweep = () => {
    const now = Date.now();
    byKey.forEach(run => {
      if (run.expiresAt <= now) {
        byKey.delete(run.runKey);
        byId.delete(run.runId);
      }
    });
    localResults.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        localResults.delete(key);
      }
    });
  };

  const count = (matches: (run: ActiveRun) => boolean) => {
    let total = 0;
    byKey.forEach(run => {
      if (matches(run)) {
        total += 1;
      }
    });

    return total;
  };

  /**
   * Takes the key, here and — when there is one — everywhere.
   *
   * `increment` is the primitive because it is the only atomic one the adapter contract has, and it says exactly
   * what is needed: the caller whose increment answers `1` created the key and holds it. The lifetime is set by
   * that same caller, which is the rule `createKvStore` already follows for a rate-limit window; the gap between
   * the two calls is a key that outlives its holder if the process dies inside it, and it is the same gap that
   * idiom has always had.
   */
  const ttlSeconds = (ttlMs: number): number => Math.max(1, Math.ceil(ttlMs / 1000));

  const takeShared = async (runKey: string, ttlMs: number): Promise<boolean> => {
    if (!store) {
      return true;
    }

    const held = await store.increment(`${keyPrefix}${runKey}`, 1);
    if (held !== 1) {
      return false;
    }

    await store.expire(`${keyPrefix}${runKey}`, ttlSeconds(ttlMs));

    return true;
  };

  const begin = async (params: BeginRunParams): Promise<ActiveRun> => {
    sweep();

    const runKey = deriveRunKey(params);
    const existing = byKey.get(runKey);
    if (existing) {
      throw new ActionRunError('duplicate', `This action is already running as ${existing.runId}`);
    }

    /**
     * Two budgets, because they are two different risks.
     *
     * A call is counted against its space AND the process: one space's callers must not starve another's, and
     * neither may take the box down. A render is counted against the PROCESS alone — it arrives because people
     * are reading the page, so a per-space ceiling would refuse the visitor who made the space worth having.
     */
    const kind = params.kind ?? 'call';
    const overCapacity =
      kind === 'render'
        ? count(run => run.kind === 'render') >= renderPerProcess
        : count(run => run.kind === 'call') >= perProcess ||
          count(run => run.kind === 'call' && run.spaceId === params.spaceId) >= perSpace;
    if (overCapacity) {
      throw new ActionRunError('over_capacity', 'Too many actions are running right now');
    }

    const run: ActiveRun = {
      runId: randomUUID(),
      runKey,
      kind,
      spaceId: params.spaceId,
      actionId: params.actionId,
      callerId: params.callerId,
      controller: new AbortController(),
      expiresAt: Date.now() + params.ttlMs,
      explicitKey: Boolean(params.idempotencyKey)
    };
    /**
     * The local slot is taken BEFORE anything is awaited, and that ordering is the guarantee.
     *
     * Everything above this line runs in one synchronous stretch, so two callers in the same process cannot both
     * pass it — which is what made this work when `begin` was synchronous throughout. Reach for the store first
     * and both of them would sail through the local check while the other was suspended on it.
     */
    byKey.set(runKey, run);
    byId.set(run.runId, run);

    try {
      // And only THEN the shared one, so a run refused locally never leaves a key another replica has to wait out.
      if (!(await takeShared(runKey, params.ttlMs))) {
        throw new ActionRunError('duplicate', 'This action is already running');
      }
    } catch (error) {
      byKey.delete(runKey);
      byId.delete(run.runId);

      throw error;
    }

    // Who owns it, published where every replica can read it: a cancel is authorized against this rather than
    // against a run only one process can see. Best-effort — a store that cannot remember the owner costs a
    // cross-replica cancel, never the run itself.
    await store?.set(runOwnerKey(run.runId), params.callerId, ttlSeconds(params.ttlMs)).catch(() => undefined);

    return run;
  };

  /**
   * Remembers what a run answered, for a caller that asks again by the same key.
   *
   * Only a COMPLETED run, and only a key the caller named. A failure is not replayed because a retry after one is
   * the reasonable thing to do — pinning a transient outage for the whole window would turn a blip into an hour
   * of it — and a derived key would make two deliberate identical calls into one.
   */
  const remember = async (run: ActiveRun, outcome: ActionCallResult) => {
    if (replayTtlMs <= 0 || !run.explicitKey || outcome.status !== 'completed') {
      return;
    }

    // The ANSWER and nothing else. A run result carries its trace, which is the author's own data and can be
    // large; a replay owes the caller exactly what the first call returned.
    const answer: ActionCallResult = { runId: outcome.runId, status: outcome.status, output: outcome.output };
    if (!store) {
      localResults.set(run.runKey, { expiresAt: Date.now() + replayTtlMs, result: answer });

      return;
    }

    await store.set(runResultKey(run.runKey), JSON.stringify(answer), ttlSeconds(replayTtlMs)).catch(() => undefined);
  };

  const end = async (run: ActiveRun, outcome?: ActionCallResult) => {
    byKey.delete(run.runKey);
    byId.delete(run.runId);
    if (outcome) {
      await remember(run, outcome);
    }

    // Released rather than left to expire: the next caller of this key is usually the same person retrying, and
    // making them wait out a timeout for a run that is already over is the failure single-flight exists to avoid.
    // A store that cannot answer must not fail a run that has already finished its work.
    await store?.delete(`${keyPrefix}${run.runKey}`).catch(() => undefined);
    await store?.delete(runOwnerKey(run.runId)).catch(() => undefined);
    await store?.delete(runCancelKey(run.runId)).catch(() => undefined);
  };

  /**
   * The answer this key already produced, if it is still inside the window.
   *
   * Asked BEFORE a slot is taken, so a retry of something that already happened costs nothing and — this is the
   * point — does not happen twice. Single-flight covers the retry that arrives while the first run is going; this
   * covers the one that arrives a minute after it finished, which is the shape every webhook provider retries in.
   */
  const replay = async (params: BeginRunParams): Promise<ActionCallResult | undefined> => {
    if (replayTtlMs <= 0 || !params.idempotencyKey) {
      return undefined;
    }

    const runKey = deriveRunKey(params);
    if (!store) {
      sweep();

      return localResults.get(runKey)?.result;
    }

    try {
      const stored = await store.get(runResultKey(runKey));

      return stored ? (JSON.parse(stored) as ActionCallResult) : undefined;
    } catch {
      // A store that cannot answer, or an entry that is not the shape it was written as. Running the flow again
      // is the safe half: replay is an optimisation over doing the work, never a substitute for being able to.
      return undefined;
    }
  };

  /**
   * Only the caller that started a run may stop it.
   *
   * A run id is a bearer string that travels to the browser, and without this check anyone holding one could stop
   * another visitor's checkout — a denial of service addressed at a single person.
   *
   * Local first, because a cancel that reaches the right replica should stop the flow at its next boundary rather
   * than a store round trip later. When it does not — the usual case behind a load balancer — the request leaves
   * the flag the running replica polls, and ownership is checked against what `begin` published.
   */
  const cancel = async (runId: string, callerId: string): Promise<boolean> => {
    const run = byId.get(runId);
    if (run) {
      if (run.callerId !== callerId) {
        return false;
      }

      run.controller.abort();
      await store?.set(runCancelKey(runId), '1', ttlSeconds(run.expiresAt - Date.now())).catch(() => undefined);

      return true;
    }

    if (!store) {
      return false;
    }

    try {
      const owner = await store.get(runOwnerKey(runId));
      if (owner !== callerId) {
        return false;
      }

      // The owner key's own lifetime is the run's, so the flag only has to outlive what is left of it.
      await store.set(runCancelKey(runId), '1', CANCEL_FLAG_TTL_SECONDS);

      return true;
    } catch {
      return false;
    }
  };

  return { begin, end, get: runId => byId.get(runId), replay, cancel, active: () => byKey.size };
};
