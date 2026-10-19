import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { FunctionContext } from './contract';
import type { FunctionCall, WireBody, WireFetchInit, WireRequest, WireResponse } from './protocol';
import type { LaterRequest } from '../actions/jobs/later';
import type { KvListEntry, KvListPutOptions, KvListRange } from '../actions/runtime/kvList';
import type { RateLimit } from '../actions/runtime/rateLimit';
import type { ActionKvStore } from '../actions/types';

const TEXTUAL = /^(text\/|application\/([\w.+-]*\+)?(json|xml|javascript|x-www-form-urlencoded))/i;

/** A body as the wire carries it: as text when its type says it is text, base64 otherwise. */
export const wireBodyOf = async (body: Body, contentType: string | null): Promise<WireBody | null> => {
  const bytes = Buffer.from(await body.arrayBuffer());
  if (!bytes.length) {
    return null;
  }

  return contentType && TEXTUAL.test(contentType)
    ? { text: bytes.toString('utf8') }
    : { base64: bytes.toString('base64') };
};

export const bodyOf = (body: WireBody | null): string | Uint8Array<ArrayBuffer> | null => {
  if (!body) {
    return null;
  }

  return 'text' in body ? body.text : new Uint8Array(Buffer.from(body.base64, 'base64'));
};

export const wireResponseOf = async (response: Response): Promise<WireResponse> => ({
  status: response.status,
  statusText: response.statusText,
  headers: [...response.headers],
  body: await wireBodyOf(response, response.headers.get('content-type'))
});

export const wireRequestOf = async (request: Request): Promise<WireRequest> => ({
  method: request.method,
  url: request.url,
  headers: [...request.headers],
  body: await wireBodyOf(request, request.headers.get('content-type'))
});

export const responseOf = ({ status, statusText, headers, body }: WireResponse): Response =>
  new Response(bodyOf(body), { status, statusText, headers });

class CallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallError';
  }
}

const stringArg = (value: unknown, what: string): string => {
  if (typeof value !== 'string') {
    throw new CallError(`${what} is a string`);
  }

  return value;
};

const numberArg = (value: unknown, what: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CallError(`${what} is a number`);
  }

  return value;
};

const optionalNumber = (value: unknown, what: string): number | undefined =>
  value === undefined || value === null ? undefined : numberArg(value, what);

const headerPairsOf = (value: unknown): [string, string][] =>
  Array.isArray(value)
    ? value.flatMap((pair: unknown) =>
        Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string'
          ? [[pair[0], pair[1]] satisfies [string, string]]
          : []
      )
    : [];

const wireBodyFrom = (value: unknown): WireBody | null => {
  const body = isRecord(value) ? value : undefined;

  return body && typeof body.text === 'string'
    ? { text: body.text }
    : body && typeof body.base64 === 'string'
      ? { base64: body.base64 }
      : null;
};

/** An answer that crossed a boundary as a wire response — from a space's code, or from the platform — read, not trusted. */
export const wireResponseFrom = (value: unknown): WireResponse => {
  const answer = isRecord(value) ? value : {};

  return {
    status: typeof answer.status === 'number' && answer.status >= 200 && answer.status <= 599 ? answer.status : 500,
    statusText: typeof answer.statusText === 'string' ? answer.statusText : '',
    headers: headerPairsOf(answer.headers),
    body: wireBodyFrom(answer.body)
  };
};

/** A request that crossed as a wire request, as a web `Request` again — what a route handler outside the sandbox takes. */
export const requestFromWire = (value: unknown): Request => {
  const wire = isRecord(value) ? value : {};
  const method = typeof wire.method === 'string' ? wire.method : 'GET';

  return new Request(typeof wire.url === 'string' ? wire.url : 'http://runtime.invalid/', {
    method,
    headers: headerPairsOf(wire.headers),
    body: method === 'GET' || method === 'HEAD' ? null : bodyOf(wireBodyFrom(wire.body))
  });
};

const recordArg = (value: unknown, what: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new CallError(`${what} is an object`);
  }

  return value;
};

const listEntryOf = (value: unknown): KvListEntry => {
  const entry = recordArg(value, 'A list entry');

  return {
    id: stringArg(entry.id, 'A list entry’s id'),
    score: numberArg(entry.score, 'A list entry’s score'),
    value: entry.value
  };
};

const putOptionsOf = (value: unknown): KvListPutOptions => {
  if (value === undefined || value === null) {
    return {};
  }

  const options = recordArg(value, 'List options');
  const keep = optionalNumber(options.keep, 'keep');

  return { ...(keep === undefined ? {} : { keep }), ...(options.higherOnly === true ? { higherOnly: true } : {}) };
};

const rangeOf = (value: unknown): KvListRange => {
  if (value === undefined || value === null) {
    return {};
  }

  const range = recordArg(value, 'A list range');
  const offset = optionalNumber(range.offset, 'offset');
  const limit = optionalNumber(range.limit, 'limit');

  return {
    ...(offset === undefined ? {} : { offset }),
    ...(limit === undefined ? {} : { limit }),
    ...(range.order === 'asc' || range.order === 'desc' ? { order: range.order } : {})
  };
};

/**
 * One `kv` call, its arguments read rather than trusted: they were written by the space's code, and the store below
 * takes typed values. The space's namespace is the store's, applied by the platform before the code ever had it.
 */
const kvCall = (kv: ActionKvStore, method: string, args: unknown[]): Promise<unknown> => {
  const [first, second, third, fourth] = args;
  switch (method) {
    case 'get':
      return kv.get(stringArg(first, 'A key'));
    case 'set':
      return kv.set(stringArg(first, 'A key'), second, optionalNumber(third, 'A lifetime'));
    case 'delete':
      return kv.delete(stringArg(first, 'A key'));
    case 'increment':
      return kv.increment(
        stringArg(first, 'A key'),
        numberArg(second, 'An amount'),
        optionalNumber(third, 'A lifetime')
      );
    case 'swap':
      return kv.swap(stringArg(first, 'A key'), second ?? undefined, third, optionalNumber(fourth, 'A lifetime'));
    case 'listPut':
      return kv.listPut(stringArg(first, 'A list'), listEntryOf(second), putOptionsOf(third));
    case 'listRange':
      return kv.listRange(stringArg(first, 'A list'), rangeOf(second));
    case 'listRemove':
      return kv.listRemove(stringArg(first, 'A list'), stringArg(second, 'An entry id'));
    default:
      return Promise.reject(new CallError(`kv has no "${method}"`));
  }
};

const fetchInitOf = (value: unknown): WireFetchInit => {
  const init = recordArg(value, 'A request');
  const headers = init.headers === undefined ? {} : recordArg(init.headers, 'Headers');

  return {
    ...(init.method === undefined ? {} : { method: stringArg(init.method, 'A method') }),
    headers: Object.fromEntries(
      Object.entries(headers).map(([name, header]) => [name, stringArg(header, `Header "${name}"`)])
    ),
    ...(init.body === undefined || init.body === null ? {} : { body: stringArg(init.body, 'A body') }),
    ...(init.credential === undefined ? {} : { credential: stringArg(init.credential, 'A credential') })
  };
};

const optionalString = (value: unknown, what: string): string | undefined =>
  value === undefined || value === null ? undefined : stringArg(value, what);

/** The code's number for a request it may cut short — see {@link FunctionCall}. */
const requestArg = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new CallError('A request is named by a whole number');
  }

  return value;
};

const cutShort = (value: unknown): { request: number } | Record<string, never> =>
  value === undefined || value === null ? {} : { request: requestArg(value) };

/** A call to `ctx.jobs`, read into the one method it names: a name and an object for `start`, an id for the rest. */
const jobsCallOf = (call: Record<string, unknown>): FunctionCall => {
  switch (call.method) {
    case 'start': {
      const key = optionalString(call.key, 'A key');
      if (call.input !== undefined && !isRecord(call.input)) {
        throw new CallError('A job is handed an object as its input');
      }

      return {
        op: 'jobs',
        method: 'start',
        name: stringArg(call.name, 'A job'),
        input: isRecord(call.input) ? call.input : {},
        ...(key === undefined ? {} : { key })
      };
    }
    case 'get':
    case 'pause':
    case 'resume':
    case 'cancel':
      return { op: 'jobs', method: call.method, id: stringArg(call.id, 'A job id') };
    default:
      throw new CallError('Not a jobs method the platform answers');
  }
};

/** A job's `save` or `report`, from its slice. */
const jobCallOf = (call: Record<string, unknown>): FunctionCall => {
  if (call.method === 'save') {
    return { op: 'job', method: 'save', state: call.state };
  }

  if (call.method === 'report') {
    if (typeof call.fraction !== 'number' || !Number.isFinite(call.fraction)) {
      throw new CallError('job.report takes how far it is, a number from 0 to 1');
    }

    const step = optionalString(call.step, 'A step');

    return { op: 'job', method: 'report', fraction: call.fraction, ...(step === undefined ? {} : { step }) };
  }

  throw new CallError('Not a job method the platform answers');
};

/** A call to `ctx.oauth`, read into the one method it names: what each method takes, and an owner only as a string. */
const oauthCallOf = (call: Record<string, unknown>): FunctionCall => {
  const connection = stringArg(call.connection, 'An OAuth connection');
  const owner = optionalString(call.owner, 'An OAuth owner');
  const own = owner === undefined ? {} : { owner };
  switch (call.method) {
    case 'connect': {
      const params =
        call.authorizeParams === undefined ? undefined : recordArg(call.authorizeParams, 'authorizeParams');

      return {
        op: 'oauth',
        method: 'connect',
        connection,
        returnTo: stringArg(call.returnTo, 'returnTo'),
        ...(params === undefined
          ? {}
          : {
              authorizeParams: Object.fromEntries(
                Object.entries(params).map(([key, value]) => [key, stringArg(value, `authorizeParams.${key}`)])
              )
            }),
        ...own
      };
    }
    case 'status':
    case 'disconnect':
    case 'token':
      return { op: 'oauth', method: call.method, connection, ...own };
    case 'fetch': {
      // A credential is not the OAuth fetch's to name: the connection is what it spends.
      const { credential: _credential, ...init } = fetchInitOf(call.init ?? {});

      return {
        op: 'oauth',
        method: 'fetch',
        connection,
        url: stringArg(call.url, 'A URL'),
        init,
        ...own,
        ...cutShort(call.request)
      };
    }
    default:
      throw new CallError('Not an OAuth method the platform answers');
  }
};

/** What a run set for later is checked against where it is queued (`laterFor`); here only that it is what it claims. */
const laterOf = (value: unknown): LaterRequest => {
  const request = recordArg(value, 'A run set for later');
  const key = optionalString(request.key, 'A key');

  return {
    action: stringArg(request.action, 'An action'),
    in: numberArg(request.in, 'in'),
    ...(request.input === undefined ? {} : { input: recordArg(request.input, 'An input') }),
    ...(key === undefined ? {} : { key })
  };
};

/** A limit's numbers are checked where it is counted (`countRate`); here only that they are what they claim. */
const rateLimitOf = (value: unknown): RateLimit => {
  const limit = recordArg(value, 'A rate limit');

  return {
    most: numberArg(limit.most, 'most'),
    perSeconds: numberArg(limit.perSeconds, 'perSeconds'),
    ...(limit.per === 'everyone' || limit.per === 'caller' ? { per: limit.per } : {})
  };
};

/**
 * A call as the code sent it, read into what it claims to be — every field checked, because it was written by the
 * space's code and carried by a runner, and neither is trusted here. The only place a call is read.
 */
export const readCall = (value: unknown): FunctionCall => {
  const call = recordArg(value, 'A call');
  switch (call.op) {
    case 'kv':
      return {
        op: 'kv',
        method: stringArg(call.method, 'A kv method'),
        args: Array.isArray(call.args) ? call.args : []
      };
    case 'fetch':
      return {
        op: 'fetch',
        url: stringArg(call.url, 'A URL'),
        init: fetchInitOf(call.init ?? {}),
        ...cutShort(call.request)
      };
    case 'abort':
      return { op: 'abort', request: requestArg(call.request) };
    case 'publish':
      return {
        op: 'publish',
        topic: stringArg(call.topic, 'A topic'),
        type: stringArg(call.type, 'A type'),
        data: call.data
      };
    case 'grant': {
      const ttlSeconds = optionalNumber(call.ttlSeconds, 'A lifetime');

      return {
        op: 'grant',
        topic: stringArg(call.topic, 'A topic'),
        ...(ttlSeconds === undefined ? {} : { ttlSeconds })
      };
    }
    case 'revoke': {
      const grant = optionalString(call.grant, 'A grant');

      return { op: 'revoke', topic: stringArg(call.topic, 'A topic'), ...(grant === undefined ? {} : { grant }) };
    }
    case 'later':
      return { op: 'later', request: laterOf(call.request) };
    case 'cancelLater':
      return { op: 'cancelLater', key: stringArg(call.key, 'A key') };
    case 'rateLimit':
      return { op: 'rateLimit', bucket: stringArg(call.bucket, 'A bucket'), limit: rateLimitOf(call.limit) };
    case 'sign':
      return { op: 'sign', value: stringArg(call.value, 'A value') };
    case 'verify':
      return {
        op: 'verify',
        value: stringArg(call.value, 'A value'),
        signature: stringArg(call.signature, 'A signature')
      };
    case 'data':
      return { op: 'data', file: stringArg(call.file, 'A file') };
    case 'oauth':
      return oauthCallOf(call);
    case 'jobs':
      return jobsCallOf(call);
    case 'job':
      return jobCallOf(call);
    case 'log':
      return { op: 'log', values: Array.isArray(call.values) ? call.values : [] };
    case 'emit':
      return { op: 'emit', chunk: call.chunk };
    default:
      throw new CallError('Not a call the platform answers');
  }
};

/** One invocation's requests the code may cut short, by its number for each — and the cuts that came first. */
type Cuts = { live: Map<number, AbortController>; early: Set<number> };

/** Keyed by the invocation's context: every call of one invocation is answered with the same one. */
const cutsByRun = new WeakMap<FunctionContext, Cuts>();

const cutsOf = (ctx: FunctionContext): Cuts => {
  const known = cutsByRun.get(ctx);
  if (known) {
    return known;
  }

  const made: Cuts = { live: new Map(), early: new Set() };
  cutsByRun.set(ctx, made);

  return made;
};

/** The work of a request the code numbered, handed the signal its `abort` fires — even one that arrived first. */
const cuttable = async <T>(
  ctx: FunctionContext,
  request: number | undefined,
  work: (cut: { signal?: AbortSignal }) => Promise<T>
): Promise<T> => {
  if (request === undefined) {
    return work({});
  }

  const cuts = cutsOf(ctx);
  const controller = new AbortController();
  if (cuts.early.delete(request)) {
    controller.abort();
  }

  cuts.live.set(request, controller);
  try {
    return await work({ signal: controller.signal });
  } finally {
    cuts.live.delete(request);
  }
};

/**
 * Answers one call from a space's code with the run's own {@link FunctionContext} — the same object a self-hosted
 * server hands its functions, so the sandbox can do exactly what native code can and not one thing more.
 */
export const answerCall = async (ctx: FunctionContext, call: FunctionCall): Promise<unknown> => {
  switch (call.op) {
    case 'kv':
      return kvCall(ctx.kv, call.method, call.args);
    case 'fetch':
      return cuttable(ctx, call.request, async cut =>
        wireResponseOf(await ctx.fetch(call.url, { ...call.init, ...cut }))
      );
    case 'abort': {
      const cuts = cutsOf(ctx);
      const live = cuts.live.get(call.request);
      if (live) {
        live.abort();
      } else {
        cuts.early.add(call.request);
      }

      return null;
    }
    case 'publish':
      return ctx.publish(call.topic, call.type, call.data);
    case 'grant':
      return ctx.grant(call.topic, call.ttlSeconds);
    case 'revoke':
      return ctx.revoke(call.topic, call.grant);
    case 'later':
      return ctx.later(call.request);
    case 'cancelLater':
      return ctx.cancelLater(call.key);
    case 'rateLimit':
      return ctx.rateLimit(call.bucket, call.limit);
    case 'sign':
      return ctx.sign(call.value);
    case 'verify':
      return ctx.verify(call.value, call.signature);
    case 'data':
      return ctx.data(call.file);
    case 'oauth':
      switch (call.method) {
        case 'connect':
          return ctx.oauth.connect(call.connection, {
            returnTo: call.returnTo,
            ...(call.authorizeParams === undefined ? {} : { authorizeParams: call.authorizeParams }),
            ...(call.owner === undefined ? {} : { owner: call.owner })
          });
        case 'status':
          return ctx.oauth.status(call.connection, call.owner === undefined ? {} : { owner: call.owner });
        case 'disconnect':
          return ctx.oauth.disconnect(call.connection, call.owner === undefined ? {} : { owner: call.owner });
        case 'token':
          return ctx.oauth.token(call.connection, call.owner === undefined ? {} : { owner: call.owner });
        case 'fetch':
          return cuttable(ctx, call.request, async cut =>
            wireResponseOf(
              await ctx.oauth.fetch(call.connection, call.url, {
                ...call.init,
                ...cut,
                ...(call.owner === undefined ? {} : { owner: call.owner })
              })
            )
          );
      }

      break;
    case 'jobs':
      switch (call.method) {
        case 'start':
          return ctx.jobs.start(call.name, call.input, call.key === undefined ? {} : { key: call.key });
        case 'get':
          return (await ctx.jobs.get(call.id)) ?? null;
        case 'pause':
          return ctx.jobs.pause(call.id);
        case 'resume':
          return ctx.jobs.resume(call.id);
        case 'cancel':
          return ctx.jobs.cancel(call.id);
      }

      break;
    // A job's slice answers its own `save` and `report`: anywhere else there is no job to keep anything for.
    case 'job':
      throw new CallError('job.save and job.report belong to a job, inside its run');
    case 'log':
      ctx.log(...call.values);

      return undefined;
    case 'emit':
      ctx.emit(call.chunk);

      return undefined;
  }
};
