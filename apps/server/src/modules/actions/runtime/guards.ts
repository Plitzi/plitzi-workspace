import { createHash, randomUUID } from 'node:crypto';

import { ActionRunError } from './errors';

/** A run currently holding a slot, and the handle that can stop it. */
export type ActiveRun = {
  runId: string;
  runKey: string;
  spaceId: number;
  actionId: string;
  callerId: string;
  controller: AbortController;
  expiresAt: number;
};

export type RunGuardsConfig = {
  perSpace?: number;
  perProcess?: number;
};

export type BeginRunParams = {
  spaceId: number;
  actionId: string;
  callerId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  ttlMs: number;
};

export type RunGuards = {
  begin: (params: BeginRunParams) => ActiveRun;
  end: (run: ActiveRun) => void;
  get: (runId: string) => ActiveRun | undefined;
  cancel: (runId: string, callerId: string) => boolean;
  active: () => number;
};

const DEFAULTS = { perSpace: 10, perProcess: 100 };

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
 * In-process, deliberately: it is honest for a single replica and it is the seam a deployment replaces with a
 * Redis-backed store when it runs several. What it must never become is a silent no-op across replicas — hence
 * the store being a construction parameter later, rather than something callers can forget to pass.
 */
export const createRunGuards = (config: RunGuardsConfig = {}): RunGuards => {
  const perSpace = config.perSpace ?? DEFAULTS.perSpace;
  const perProcess = config.perProcess ?? DEFAULTS.perProcess;
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

  const countForSpace = (spaceId: number) => {
    let count = 0;
    byKey.forEach(run => {
      if (run.spaceId === spaceId) {
        count += 1;
      }
    });

    return count;
  };

  const begin = (params: BeginRunParams): ActiveRun => {
    sweep();

    const runKey = deriveRunKey(params);
    const existing = byKey.get(runKey);
    if (existing) {
      throw new ActionRunError('duplicate', `This action is already running as ${existing.runId}`);
    }

    if (byKey.size >= perProcess || countForSpace(params.spaceId) >= perSpace) {
      throw new ActionRunError('over_capacity', 'Too many actions are running right now');
    }

    const run: ActiveRun = {
      runId: randomUUID(),
      runKey,
      spaceId: params.spaceId,
      actionId: params.actionId,
      callerId: params.callerId,
      controller: new AbortController(),
      expiresAt: Date.now() + params.ttlMs
    };
    byKey.set(runKey, run);
    byId.set(run.runId, run);

    return run;
  };

  const end = (run: ActiveRun) => {
    byKey.delete(run.runKey);
    byId.delete(run.runId);
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
