import type { FunctionContext, FunctionFetchInit } from './contract';
import type { FunctionsManifest } from '@plitzi/sdk-shared';

/**
 * The messages between the platform and whatever runs a space's code — the one protocol every runner speaks, whether
 * it is in the process, a service of ours or a provider's. Versioned, because a runner is deployed apart from the
 * platform that calls it.
 */
export const FUNCTIONS_PROTOCOL = 1;

/** A built bundle: `id` is its content digest, so a runner that has one never needs the code again. */
export type FunctionsBundle = { id: string; code: string };

/**
 * What one invocation may spend — the portable subset every runner can enforce, each mapped to its own knobs. The
 * platform sets them per space (its plan) and never above the deployment's ceilings.
 */
export type FunctionLimits = {
  /** CPU time the code may use, awaits not counted. */
  cpuMs: number;
  /** Wall time, from the moment it starts: the run's remaining budget, at most. */
  wallMs: number;
  memoryMb: number;
  /** The size of what it answers, as JSON. */
  outputBytes: number;
  /** Calls back to the platform: `kv`, `fetch`, `publish`… */
  calls: number;
};

/** Text travels as text; anything else base64, so a body is never mangled crossing a boundary that only speaks JSON. */
export type WireBody = { text: string } | { base64: string };

export type WireHeaders = [string, string][];

export type WireRequest = { method: string; url: string; headers: WireHeaders; body: WireBody | null };

export type WireResponse = { status: number; statusText: string; headers: WireHeaders; body: WireBody | null };

/** Who and what an invocation is for: the facts a {@link FunctionContext} carries, sent with it rather than asked for. */
export type FunctionInvocationContext = Pick<
  FunctionContext,
  'spaceId' | 'environment' | 'runId' | 'trigger' | 'callerId' | 'user'
>;

export type FunctionInvocation =
  | { kind: 'task'; name: string; params: Record<string, unknown>; context: FunctionInvocationContext }
  | {
      kind: 'route';
      key: string;
      params: Record<string, string>;
      request: WireRequest;
      context: FunctionInvocationContext;
    };

/**
 * One call back from the code to the platform: a {@link FunctionContext} method, by name, with its arguments. The
 * platform answers it with the run's own context — scoped to the space and the run before anything is done.
 */
export type FunctionCall =
  | { op: 'kv'; method: string; args: unknown[] }
  | { op: 'fetch'; url: string; init: FunctionFetchInit }
  | { op: 'publish'; topic: string; type: string; data: unknown }
  | { op: 'grant'; topic: string; ttlSeconds?: number }
  | { op: 'revoke'; topic: string; grant?: string }
  /** Each value as the guest could send it: JSON, with what JSON cannot say already said as text. */
  | { op: 'log'; values: unknown[] }
  | { op: 'emit'; chunk: unknown };

/** How a call or an invocation ended: its value, or why not — never a thrown object crossing the boundary. */
export type FunctionAnswer = { ok: true; value: unknown } | { ok: false; error: string };

/** Why the runner stopped an invocation, when it was not the code's own error. */
export type FunctionStopReason = 'cpu' | 'wall' | 'memory' | 'output' | 'calls' | 'aborted';

/** What the platform asks a runner for: every runner implements this, and nothing else of it is assumed. */
export type FunctionRunner = {
  /** Loads a bundle and answers what it declares — when the space's functions are saved, never on a run. */
  describe: (bundle: FunctionsBundle) => Promise<unknown>;
  /**
   * Runs one task or route of a bundle. Each call the code makes is handed to `answer`, whose result goes back to it;
   * `signal` aborting ends the invocation. Resolves with what the code returned, and rejects with a
   * {@link FunctionFailure}.
   */
  invoke: (request: FunctionInvokeRequest) => Promise<unknown>;
  close?: () => Promise<void>;
};

/** What one invocation spent — what a deployment meters and budgets by. */
export type FunctionUsage = { cpuMs: number; wallMs: number; calls: number };

export type FunctionInvokeRequest = {
  bundle: FunctionsBundle;
  invocation: FunctionInvocation;
  limits: FunctionLimits;
  /** Handed each call exactly as the code sent it: the platform reads it (`readCall`), trusting no runner to have. */
  answer: (call: unknown) => Promise<unknown>;
  signal: AbortSignal;
  /** Told what the invocation spent once it ends, however it ended — before `invoke` settles. */
  onUsage?: (usage: FunctionUsage) => void;
};

/** An invocation that did not answer: the code threw (`error`), or the runner stopped it (a {@link FunctionStopReason}). */
export class FunctionFailure extends Error {
  readonly reason: FunctionStopReason | 'error';

  constructor(reason: FunctionStopReason | 'error', message: string) {
    super(message);
    this.name = 'FunctionFailure';
    this.reason = reason;
  }
}

/** A space's built functions, as the platform stores them: the bundle, and what it declared when it was saved. */
export type SpaceFunctions = { bundle: FunctionsBundle; manifest: FunctionsManifest; limits?: Partial<FunctionLimits> };

/** The messages of one runner connection (our own runner service), each side's in turn. */
export type RunnerRequestMessage =
  | { type: 'describe'; protocol: number; bundle: FunctionsBundle }
  | { type: 'invoke'; protocol: number; bundleId: string; invocation: FunctionInvocation; limits: FunctionLimits }
  | { type: 'bundle'; bundle: FunctionsBundle }
  | { type: 'answer'; id: number; answer: FunctionAnswer }
  | { type: 'abort' };

export type RunnerResponseMessage =
  | { type: 'needBundle' }
  /** As the code sent it: the platform reads it, trusting no runner to have. */
  | { type: 'call'; id: number; call: unknown }
  | { type: 'done'; value: unknown; usage?: FunctionUsage }
  | { type: 'failed'; reason: FunctionStopReason | 'error'; error: string; usage?: FunctionUsage };
