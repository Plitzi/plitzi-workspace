import type { FunctionContext, FunctionFetchInit } from './contract';
import type { FunctionCall, WireBody, WireRequest, WireResponse } from './protocol';
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const fetchInitOf = (value: unknown): FunctionFetchInit => {
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
      return { op: 'fetch', url: stringArg(call.url, 'A URL'), init: fetchInitOf(call.init ?? {}) };
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
    case 'log':
      return { op: 'log', values: Array.isArray(call.values) ? call.values : [] };
    case 'emit':
      return { op: 'emit', chunk: call.chunk };
    default:
      throw new CallError('Not a call the platform answers');
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
      return wireResponseOf(await ctx.fetch(call.url, call.init));
    case 'publish':
      return ctx.publish(call.topic, call.type, call.data);
    case 'grant':
      return ctx.grant(call.topic, call.ttlSeconds);
    case 'revoke':
      return ctx.revoke(call.topic, call.grant);
    case 'rateLimit':
      return ctx.rateLimit(call.bucket, call.limit);
    case 'sign':
      return ctx.sign(call.value);
    case 'verify':
      return ctx.verify(call.value, call.signature);
    case 'log':
      ctx.log(...call.values);

      return undefined;
    case 'emit':
      ctx.emit(call.chunk);

      return undefined;
  }
};
