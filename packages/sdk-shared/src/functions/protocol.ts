import { ActionRefusal, isActionRefusal, refusalCodeOf } from './refusal';

import type { FunctionContext, FunctionFetchInit } from './contract';
import type { LaterRequest } from './later';
import type { RateLimit } from './rateLimit';
import type { FunctionsManifest } from '../types';

/**
 * The messages between the platform and whatever runs a space's code — the one protocol every runner speaks, whether
 * it is in the process, a service of ours or a provider's. Versioned, because a runner is deployed apart from the
 * platform that calls it: `major.minor`, where a minor only adds and a major may change what was there.
 *
 * 1.1 added the `busy` refusal: a runner short of memory takes no new invocation. A 1.0 platform reads it as an error.
 * 1.2 added `accepted`: the runner took the invocation — an isolate free and memory for it — and the platform's wait for
 * its answer starts then, not while it was being placed. A runner sends it to a 1.2 platform alone.
 * 1.3 added `waited`: how long the invocation waited for the runner's CPU — a turn at running JavaScript, shared with the
 * other invocations — which is the runner's time, not the code's: the platform's wait for its answer grows by it. A
 * runner sends it to a 1.3 platform alone. And `queue`: with every runner full, the platform asks one to keep the
 * invocation until it has room rather than turn it away — the runner says `queued`, then `accepted` once it starts.
 */
export const FUNCTIONS_PROTOCOL = '1.3';

const VERSION = /^(\d+)\.(\d+)$/;

/** Whether a side speaking `theirs` knows what `since` added: the same major, and that minor or a later one. */
export const protocolKnows = (theirs: unknown, since: string): boolean => {
  const sent = typeof theirs === 'string' ? VERSION.exec(theirs) : null;
  const added = VERSION.exec(since);

  return Boolean(sent && added && sent[1] === added[1] && Number(sent[2]) >= Number(added[2]));
};

/** Who speaks each side of a versioned protocol, as its refusal names them: `here` answers, `there` calls. */
export type ProtocolSides = { here: string; there: string };

/**
 * Why the side speaking `ours` cannot take a message of `theirs` — or undefined when it can: the same major, and a minor
 * it knows (the answering side takes an older caller's messages, never the other way round). The answering side is
 * deployed first for that reason, so the message names which side to upgrade. The functions protocol's sides by
 * default: a runner, answering the platform.
 */
export const protocolRefusal = (
  theirs: unknown,
  ours: string = FUNCTIONS_PROTOCOL,
  { here, there }: ProtocolSides = { here: 'runner', there: 'platform' }
): string | undefined => {
  const mine = VERSION.exec(ours);
  const sent = typeof theirs === 'string' ? VERSION.exec(theirs) : null;
  if (!mine || !sent) {
    return `This ${here} speaks protocol ${ours}, and was sent ${JSON.stringify(theirs)}, which is no version of it`;
  }

  if (sent[1] !== mine[1]) {
    const older = Number(sent[1]) < Number(mine[1]) ? `the ${there}` : `the ${here}`;

    return `This ${here} speaks protocol ${ours} and was sent ${String(theirs)}: another major. Upgrade ${older}`;
  }

  if (Number(sent[2]) > Number(mine[2])) {
    return (
      `This ${here} speaks protocol ${ours} and was sent ${String(theirs)}, newer than it knows: upgrade the ${here} ` +
      `(the ${here} is deployed before the ${there} that calls it)`
    );
  }

  return undefined;
};

/** A built bundle: `id` is its content digest, so a runner that has one never needs the code again. */
export type FunctionsBundle = { id: string; code: string };

/**
 * A bundle as a run knows it: its id, and how to fetch its code — which only a runner that has never seen that id asks
 * for. A run carries no code of its own: up to a megabyte read and sent on every run would be the run's whole cost.
 */
export type FunctionsBundleRef = { id: string; load: () => Promise<string> };

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

/**
 * A route's answer as it is written rather than once it is done — what a space's runtime answers, so a route there
 * streams as an endpoint does, with the platform's `ctx` all the same: its head at once, its body as the code writes it.
 * Never JSON: it lives in the process that holds the run, its body fed by the runner's `chunk` messages.
 */
export type StreamedRouteAnswer = {
  streamed: true;
  status: number;
  statusText: string;
  headers: WireHeaders;
  body: ReadableStream<Uint8Array>;
};

export const isStreamedRouteAnswer = (value: unknown): value is StreamedRouteAnswer =>
  typeof value === 'object' &&
  value !== null &&
  'streamed' in value &&
  value.streamed === true &&
  'body' in value &&
  value.body instanceof ReadableStream;

/** Who and what an invocation is for: the facts a {@link FunctionContext} carries, sent with it rather than asked for. */
export type FunctionInvocationContext = Pick<
  FunctionContext,
  'spaceId' | 'environment' | 'runId' | 'trigger' | 'callerId' | 'user'
>;

/** The slice of a job an invocation runs: which job, what it saved so far, and which attempt this is. */
export type FunctionJobSlice = { id: string; state?: unknown; attempt: number };

export type FunctionInvocation =
  | { kind: 'task'; name: string; params: Record<string, unknown>; context: FunctionInvocationContext }
  | {
      kind: 'job';
      name: string;
      input: Record<string, unknown>;
      job: FunctionJobSlice;
      context: FunctionInvocationContext;
      /**
       * How long the code gets to save and return once the slice is asked to end (`signal` aborting with why: the
       * `FunctionJobStop`), before the runner cuts it.
       */
      graceMs: number;
    }
  | {
      kind: 'route';
      key: string;
      params: Record<string, string>;
      request: WireRequest;
      context: FunctionInvocationContext;
    };

/** A request's init as the wire carries it: what the code wrote but its `signal`, which never crosses (`request`). */
export type WireFetchInit = Omit<FunctionFetchInit, 'signal'>;

/**
 * One call back from the code to the platform: a {@link FunctionContext} method, by name, with its arguments. The
 * platform answers it with the run's own context — scoped to the space and the run before anything is done.
 *
 * A request the code may cut short (its init had a `signal`) carries `request`, the code's own number for it, and the
 * code's `abort` names that number when the signal fires: a signal is the code's object, and does not cross.
 */
export type FunctionCall =
  | { op: 'kv'; method: string; args: unknown[] }
  | { op: 'fetch'; url: string; init: WireFetchInit; request?: number }
  | { op: 'abort'; request: number }
  | { op: 'publish'; topic: string; type: string; data: unknown }
  | { op: 'presence'; topic: string }
  | { op: 'visitor'; who: string | number }
  | { op: 'grant'; topic: string; ttlSeconds?: number }
  | { op: 'revoke'; topic: string; grant?: string }
  | { op: 'later'; request: LaterRequest }
  | { op: 'cancelLater'; key: string }
  | { op: 'rateLimit'; bucket: string; limit: RateLimit }
  | { op: 'sign'; value: string }
  | { op: 'verify'; value: string; signature: string }
  | { op: 'data'; file: string }
  | {
      op: 'oauth';
      method: 'connect';
      connection: string;
      returnTo: string;
      authorizeParams?: Record<string, string>;
      owner?: string;
    }
  | { op: 'oauth'; method: 'status' | 'disconnect' | 'token'; connection: string; owner?: string }
  | { op: 'oauth'; method: 'callbackUrl' }
  | {
      op: 'oauth';
      method: 'fetch';
      connection: string;
      url: string;
      init: Omit<WireFetchInit, 'credential'>;
      owner?: string;
      request?: number;
    }
  /** `ctx.jobs`: the space's jobs, started and stopped by its code. */
  | { op: 'jobs'; method: 'start'; name: string; input: Record<string, unknown>; key?: string }
  | { op: 'jobs'; method: 'get' | 'pause' | 'resume' | 'cancel'; id: string }
  /** A job's `save` and `report`: what its slice keeps, and how far it is. */
  | { op: 'job'; method: 'save'; state: unknown }
  | { op: 'job'; method: 'report'; fraction: number; step?: string }
  /** Each value as the guest could send it: JSON, with what JSON cannot say already said as text. */
  | { op: 'log'; values: unknown[] }
  | { op: 'emit'; chunk: unknown };

/**
 * How a call or an invocation ended: its value, or why not — never a thrown object crossing the boundary. A refusal
 * (`refused`, with its `code`) stays one on the other side: the code that made the call catches what the platform threw.
 */
export type FunctionAnswer = { ok: true; value: unknown } | { ok: false; error: string; refused?: true; code?: string };

/** What a call that threw answers across a boundary: its message, and whether — and as what — it was a refusal. */
export const failedAnswerOf = (error: unknown): Extract<FunctionAnswer, { ok: false }> => {
  const code = refusalCodeOf(error);

  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    ...(isActionRefusal(error) ? { refused: true as const } : {}),
    ...(code === undefined ? {} : { code })
  };
};

/** …and that answer thrown again on the side that made the call: a refusal as a refusal, anything else as an error. */
export const errorOfAnswer = ({ error, refused, code }: Extract<FunctionAnswer, { ok: false }>): Error =>
  refused ? new ActionRefusal(error, code === undefined ? {} : { code }) : new Error(error);

/** Why the runner stopped an invocation, when it was not the code's own error. */
export type FunctionStopReason = 'cpu' | 'wall' | 'memory' | 'output' | 'calls' | 'aborted';

/** The stops that are limits: the code asked for more than it may — never the runner's fault, nor fixed by asking again. */
export type FunctionLimitReason = Exclude<FunctionStopReason, 'aborted'>;

const FUNCTION_LIMIT_REASONS: ReadonlySet<string> = new Set<FunctionLimitReason>([
  'cpu',
  'wall',
  'memory',
  'output',
  'calls'
]);

/** Whether an invocation was stopped at a limit of its own ({@link FunctionLimitReason}). */
export const isFunctionLimit = (reason: string): reason is FunctionLimitReason => FUNCTION_LIMIT_REASONS.has(reason);

/** What the platform asks a runner for: every runner implements this, and nothing else of it is assumed. */
export type FunctionRunner = {
  /** Loads a bundle and answers what it declares — when the space's functions are saved, never on a run. */
  describe: (bundle: FunctionsBundle) => Promise<unknown>;
  /**
   * Runs one task, route or slice of a job of a bundle. Each call the code makes is handed to `answer`, whose result
   * goes back to it; `signal` aborting ends the invocation — its `reason` handed to the code as the signal's, and a
   * job's slice given its `graceMs` to save before it is cut. Resolves with what the code returned, and rejects with a
   * {@link FunctionFailure}.
   */
  invoke: (request: FunctionInvokeRequest) => Promise<unknown>;
  /**
   * Whether a runner for this space answered the last time one was asked — false for a while after none could be
   * reached. What lets a call that needs the space's code wait in the queue instead of starting and failing half-way.
   * Absent: always reachable (the runner is this process).
   */
  reachable?: (spaceId?: number) => boolean;
  close?: () => Promise<void>;
};

/** What one invocation spent — what a deployment meters and budgets by. */
export type FunctionUsage = { cpuMs: number; wallMs: number; calls: number };

export type FunctionInvokeRequest = {
  bundle: FunctionsBundleRef;
  invocation: FunctionInvocation;
  limits: FunctionLimits;
  /** Handed each call exactly as the code sent it: the platform reads it (`readCall`), trusting no runner to have. */
  answer: (call: unknown) => Promise<unknown>;
  signal: AbortSignal;
  /** Told what the invocation spent once it ends, however it ended — before `invoke` settles. */
  onUsage?: (usage: FunctionUsage) => void;
  /**
   * Told how long it waited for the runner's CPU, as it waits — a turn shared with the other invocations: the runner's
   * time, which neither its time limit nor whoever waits for its answer should count.
   */
  onWaited?: (ms: number) => void;
};

/**
 * Why an invocation did not answer: the code refused (`refused` — an `ActionRefusal`, its message written for whoever
 * asked), it threw (`error`), the runner stopped it (a {@link FunctionStopReason}), the runner took none, short of
 * memory (`busy` — another instance, or a moment later, takes it), or no runner could be reached at all
 * (`unreachable` — the invocation was never sent, so nothing of it ran).
 */
export type FunctionFailureReason = FunctionStopReason | 'error' | 'refused' | 'busy' | 'unreachable';

/** An invocation that did not answer, and why ({@link FunctionFailureReason}). */
export class FunctionFailure extends Error {
  readonly reason: FunctionFailureReason;

  constructor(reason: FunctionFailureReason, message: string) {
    super(message);
    this.name = 'FunctionFailure';
    this.reason = reason;
  }
}

/**
 * A space's functions as a run reaches them: the bundle by reference, what it declared when it was saved, and the limits
 * its plan sets.
 */
export type SpaceFunctions = {
  bundle: FunctionsBundleRef;
  manifest: FunctionsManifest;
  limits?: Partial<FunctionLimits>;
  /**
   * What runs them, when it is not the deployment's sandbox: the space's own runtime (`createRemoteRunner` to it). Its
   * bundle id then names that runtime's code, so a registry built for one never answers for another.
   */
  runner?: FunctionRunner;
};

/** The messages of one runner connection (our own runner service), each side's in turn. */
export type RunnerRequestMessage =
  | { type: 'describe'; protocol: string; bundle: FunctionsBundle }
  | {
      type: 'invoke';
      protocol: string;
      bundleId: string;
      invocation: FunctionInvocation;
      limits: FunctionLimits;
      /** Every runner was full: keep it until there is room, rather than turn it away (1.3). */
      queue?: boolean;
    }
  | { type: 'bundle'; bundle: FunctionsBundle }
  | { type: 'answer'; id: number; answer: FunctionAnswer }
  /** The invocation is asked to end — for a job's slice, with why (a `FunctionJobStop`). */
  | { type: 'abort'; reason?: string };

export type RunnerResponseMessage =
  /** The invocation was taken — a free isolate and memory for it (1.2): what its answer is waited for from. */
  | { type: 'accepted' }
  /** Kept until it has room for it (1.3, `queue`): `accepted` follows once it starts — what its time is counted from. */
  | { type: 'queued' }
  /** It waited this long for the runner's CPU since it last said (1.3): the runner's time, which the deadline grows by. */
  | { type: 'waited'; ms: number }
  | { type: 'needBundle' }
  /** A route answering as it writes: its head, then each `chunk` of its body, then `done`. */
  | { type: 'head'; status: number; statusText: string; headers: WireHeaders }
  | { type: 'chunk'; chunk: WireBody }
  /** As the code sent it: the platform reads it, trusting no runner to have. */
  | { type: 'call'; id: number; call: unknown }
  | { type: 'done'; value: unknown; usage?: FunctionUsage }
  | { type: 'failed'; reason: FunctionFailureReason; error: string; usage?: FunctionUsage };
