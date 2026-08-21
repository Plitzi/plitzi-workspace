import { createHash, randomUUID } from 'node:crypto';

import { ActionRunError } from './errors';

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
};

/**
 * The half of a key/value store single-flight needs, and nothing more.
 *
 * The same three methods `ActionKvAdapter` already declares, so a deployment that configured `action.kv` has
 * already provided this: no second store to stand up, and no adapter change.
 */
export type RunKeyStore = {
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
  ttlMs: number;
  /** Which budget this run draws on. Defaults to `call`: a trigger that says nothing is somebody asking. */
  kind?: RunKind;
};

export type RunGuards = {
  begin: (params: BeginRunParams) => Promise<ActiveRun>;
  end: (run: ActiveRun) => Promise<void>;
  get: (runId: string) => ActiveRun | undefined;
  cancel: (runId: string, callerId: string) => boolean;
  active: () => number;
};

const DEFAULTS = { perSpace: 10, perProcess: 100, renderPerProcess: 1000 };

/** Kept away from the `kv` tasks' own prefix: a flow writing `run:…` must not be able to release a run. */
const keyPrefix = 'action:run:';

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

export const deriveRunKey = ({ spaceId, actionId, callerId, input, idempotencyKey }: BeginRunParams): string => {
  if (idempotencyKey) {
    return `${spaceId}:${actionId}:${idempotencyKey}`;
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
 * - **Cancellation is not, and cannot be**: only the process running a flow holds the `AbortController` that
 *   stops it.
 */
export const createRunGuards = (config: RunGuardsConfig = {}, store?: RunKeyStore): RunGuards => {
  const perSpace = config.perSpace ?? DEFAULTS.perSpace;
  const perProcess = config.perProcess ?? DEFAULTS.perProcess;
  const renderPerProcess = config.renderPerProcess ?? DEFAULTS.renderPerProcess;
  const byKey = new Map<string, ActiveRun>();
  const byId = new Map<string, ActiveRun>();

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
  const takeShared = async (runKey: string, ttlMs: number): Promise<boolean> => {
    if (!store) {
      return true;
    }

    const held = await store.increment(`${keyPrefix}${runKey}`, 1);
    if (held !== 1) {
      return false;
    }

    await store.expire(`${keyPrefix}${runKey}`, Math.max(1, Math.ceil(ttlMs / 1000)));

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
      expiresAt: Date.now() + params.ttlMs
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

    return run;
  };

  const end = async (run: ActiveRun) => {
    byKey.delete(run.runKey);
    byId.delete(run.runId);
    // Released rather than left to expire: the next caller of this key is usually the same person retrying, and
    // making them wait out a timeout for a run that is already over is the failure single-flight exists to avoid.
    // A store that cannot answer must not fail a run that has already finished its work.
    await store?.delete(`${keyPrefix}${run.runKey}`).catch(() => undefined);
  };

  /**
   * Only the caller that started a run may stop it.
   *
   * A run id is a bearer string that travels to the browser, and without this check anyone holding one could stop
   * another visitor's checkout — a denial of service addressed at a single person.
   */
  const cancel = (runId: string, callerId: string): boolean => {
    const run = byId.get(runId);
    if (!run || run.callerId !== callerId) {
      return false;
    }

    run.controller.abort();

    return true;
  };

  return { begin, end, get: runId => byId.get(runId), cancel, active: () => byKey.size };
};
