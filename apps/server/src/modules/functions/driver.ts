import type { changeKv } from '../actions/runtime/kvChange';

/**
 * What a driver needs of where it runs: the way to the platform, and that place's own `Request` and `Response`.
 */
export type FunctionsDriverEnvironment = {
  /** A call to the platform (a `FunctionCall`): its value, or it throws what the platform said. */
  call: (message: Record<string, unknown>) => Promise<unknown>;
  /** Aborted when the invocation is: `ctx.signal`, this environment's own `AbortSignal`, handed through untouched. */
  signal: unknown;
  /** What `ctx.fetch` was answered, as this environment's `Response`. */
  responseOf: (wire: Record<string, unknown>) => unknown;
  /** A route's request, as this environment's `Request`. */
  requestOf: (wire: Record<string, unknown>) => unknown;
  /** What a route answered, as the wire carries it — `undefined` when it is not this environment's `Response`. */
  wireOfResponse: (response: unknown) => Promise<Record<string, unknown> | undefined>;
  changeKv: typeof changeKv;
  /** The error a refusal is: what the code throws to tell whoever asked, not a fault. */
  refusal: (message: string) => Error;
};

/**
 * What a definition declares, as the platform reads a manifest (`readManifest`) — nothing of it trusted there. Printed
 * into the sandbox's guest and imported by a space runtime, like the driver below: self-contained for that.
 */
export const describeFunctions = (definition: unknown): Record<string, unknown> => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const found = isRecord(definition) ? definition : {};
  const allow = isRecord(found.allow) ? found.allow : {};

  return {
    hosts: listOf(allow.hosts),
    tasks: listOf(found.tasks).map(task =>
      isRecord(task)
        ? {
            namespace: task.namespace,
            action: task.action,
            title: task.title,
            description: task.description,
            params: task.params,
            limits: task.limits
          }
        : {}
    ),
    routes: isRecord(found.routes) ? Object.keys(found.routes) : [],
    limits: found.limits
  };
};

/**
 * A space's functions, driven: one invocation of a definition — a task or a route, with a `ctx` whose every method is
 * a call to the platform.
 *
 * The one driver there is. The sandbox's guest is handed this function's SOURCE and runs it inside the isolate
 * (`isolate.ts`), and a space runtime imports it and runs it in its own process — so code behaves the same in both, down
 * to `ctx`. Self-contained by contract for that: no import, nothing of this module's, only what `environment` brings.
 */
export const createFunctionsDriver = (environment: FunctionsDriverEnvironment) => {
  const { call, signal, responseOf, requestOf, wireOfResponse, refusal } = environment;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const isCallable = (value: unknown): value is (...args: unknown[]) => unknown => typeof value === 'function';

  const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

  /** A value as the wire can carry it; how a line reads is the platform's (`lineOf`), not the driver's. */
  const wireValue = (value: unknown): unknown => {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }

    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
      return typeof value;
    }

    return value;
  };

  /** `ctx.log`, and whatever else the code writes a line with: onto its step, never failing the code for it. */
  const log = (...values: unknown[]): void => {
    call({ op: 'log', values: values.map(wireValue) }).catch(() => undefined);
  };

  const contextOf = (invocation: Record<string, unknown>) => {
    const facts = isRecord(invocation.context) ? invocation.context : {};

    const kvCall =
      (method: string) =>
      (...args: unknown[]): Promise<unknown> =>
        call({ op: 'kv', method, args });
    const kv = {
      get: kvCall('get'),
      set: kvCall('set'),
      delete: kvCall('delete'),
      increment: kvCall('increment'),
      swap: (key: string, expected: unknown, next: unknown, ttlSeconds?: number): Promise<boolean> =>
        kvCall('swap')(key, expected, next, ttlSeconds).then(written => written === true),
      listPut: kvCall('listPut'),
      listRange: kvCall('listRange'),
      listRemove: kvCall('listRemove'),
      change: (
        key: string,
        change: (current: unknown) => unknown,
        lifetime?: number | ((next: unknown) => number | undefined)
      ): Promise<unknown> => environment.changeKv(kv, key, change, { lifetime, refusal })
    };

    return {
      ...facts,
      kv,
      fetch: async (url: string | URL, init: Record<string, unknown> = {}) => {
        const answer = await call({ op: 'fetch', url: String(url), init });

        return responseOf(isRecord(answer) ? answer : {});
      },
      publish: async (topic: string, type: string, data: unknown) => {
        await call({ op: 'publish', topic, type, data });
      },
      grant: (topic: string, ttlSeconds?: number) => call({ op: 'grant', topic, ttlSeconds }),
      revoke: async (topic: string, grant?: string) => {
        await call({ op: 'revoke', topic, grant });
      },
      later: (request: unknown) => call({ op: 'later', request }),
      cancelLater: (key: string) => call({ op: 'cancelLater', key }),
      rateLimit: async (bucket: string, limit: unknown) => {
        const count = await call({ op: 'rateLimit', bucket, limit });
        // The words to refuse with stay here: the platform only counts, and the code is what asked to be refused.
        if (isRecord(limit) && typeof limit.refuse === 'string' && isRecord(count) && count.allowed === false) {
          throw refusal(limit.refuse);
        }

        return count;
      },
      sign: (value: string) => call({ op: 'sign', value }),
      verify: (value: string, signature: string) => call({ op: 'verify', value, signature }),
      data: (file: string) => call({ op: 'data', file }),
      log,
      emit: (chunk: unknown) => {
        call({ op: 'emit', chunk }).catch(() => undefined);
      },
      signal
    };
  };

  /** One invocation: what a task returned (`null` for nothing), or the wire response a route answered. */
  const invoke = async (definition: unknown, invocation: Record<string, unknown>): Promise<unknown> => {
    const found = isRecord(definition) ? definition : {};
    const ctx = contextOf(invocation);
    if (invocation.kind === 'task') {
      const task = listOf(found.tasks).find(
        entry => isRecord(entry) && `${String(entry.namespace)}.${String(entry.action)}` === invocation.name
      );
      if (!isRecord(task) || !isCallable(task.run)) {
        throw new Error(`This space's functions have no task "${String(invocation.name)}"`);
      }

      const value: unknown = await task.run(isRecord(invocation.params) ? invocation.params : {}, ctx);

      return value === undefined ? null : value;
    }

    const routes = isRecord(found.routes) ? found.routes : {};
    const handler = routes[String(invocation.key)];
    if (!isCallable(handler)) {
      throw new Error(`This space's functions have no route "${String(invocation.key)}"`);
    }

    const request = requestOf(isRecord(invocation.request) ? invocation.request : {});
    const wire = await wireOfResponse(await handler(request, { ...ctx, params: invocation.params }));
    if (!wire) {
      throw new Error(`Route "${String(invocation.key)}" answered something that is not a Response`);
    }

    return wire;
  };

  return { invoke, log };
};
