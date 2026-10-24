import type { changeKv, changeListEntry } from '../actions/runtime/kvChange';

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
  changeListEntry: typeof changeListEntry;
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
    limits: found.limits,
    oauth: found.oauth,
    // What each job declares besides its code: `run` stays in the bundle.
    jobs: isRecord(found.jobs)
      ? Object.fromEntries(
          Object.entries(found.jobs).map(([name, job]) => [
            name,
            isRecord(job) ? { watch: job.watch, maxSeconds: job.maxSeconds } : job
          ])
        )
      : found.jobs
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

  /** What a request's `signal` is, in whichever environment: an `AbortSignal` of its own, or one written the same. */
  type CodeSignal = {
    aborted: boolean;
    reason: unknown;
    addEventListener: (type: 'abort', listener: () => void, options: { once: boolean }) => void;
    removeEventListener: (type: 'abort', listener: () => void) => void;
  };

  const isSignal = (value: unknown): value is CodeSignal =>
    isRecord(value) &&
    typeof value.aborted === 'boolean' &&
    typeof value.addEventListener === 'function' &&
    typeof value.removeEventListener === 'function';

  /** Why a request was cut: the signal's reason, as a web `fetch` rejects with it — an `AbortError` when it gave none. */
  const abortedWith = (signal: CodeSignal): Error =>
    signal.reason instanceof Error
      ? signal.reason
      : Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });

  let requests = 0;

  /**
   * A request the code may cut short with its init's `signal`: the signal stays here — it does not cross — and the
   * call is numbered, so that its firing tells the platform which request to cut (`abort`). The code stops waiting at
   * once, with the signal's reason, as a web `fetch` does.
   */
  const cuttable = (message: Record<string, unknown>, init: Record<string, unknown>): Promise<unknown> => {
    const { signal: given, ...rest } = init;
    if (given === undefined || given === null) {
      return call({ ...message, init: rest });
    }

    if (!isSignal(given)) {
      return Promise.reject(new TypeError('The signal of a request is an AbortSignal'));
    }

    if (given.aborted) {
      return Promise.reject(abortedWith(given));
    }

    const request = ++requests;

    return new Promise((resolve, reject) => {
      const cut = () => {
        call({ op: 'abort', request }).catch(() => undefined);
        reject(abortedWith(given));
      };
      given.addEventListener('abort', cut, { once: true });
      call({ ...message, init: rest, request })
        .then(resolve, reject)
        .finally(() => {
          given.removeEventListener('abort', cut);
        });
    });
  };

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
      listSwap: (list: string, id: string, expected: unknown, next: unknown): Promise<boolean> =>
        kvCall('listSwap')(list, id, expected ?? null, next).then(written => written === true),
      listChange: (
        list: string,
        id: string,
        change: (current: { id: string; score: number; value: unknown } | undefined) => unknown
      ): Promise<unknown> =>
        environment.changeListEntry(
          {
            listRange: listName =>
              kvCall('listRange')(listName).then(entries =>
                Array.isArray(entries) ? (entries as { id: string; score: number; value: unknown }[]) : []
              ),
            listSwap: (listName, entryId, expected, next) =>
              kvCall('listSwap')(listName, entryId, expected ?? null, next).then(written => written === true)
          },
          list,
          id,
          change as Parameters<typeof environment.changeListEntry>[3],
          { refusal }
        ),
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
        const answer = await cuttable({ op: 'fetch', url: String(url) }, init);

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
      jobs: {
        start: (name: string, input: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
          call({ op: 'jobs', method: 'start', name, input, key: options.key }),
        get: (id: string) => call({ op: 'jobs', method: 'get', id }).then(found => found ?? undefined),
        pause: (id: string) => call({ op: 'jobs', method: 'pause', id }),
        resume: (id: string) => call({ op: 'jobs', method: 'resume', id }),
        cancel: (id: string) => call({ op: 'jobs', method: 'cancel', id })
      },
      oauth: {
        connect: (connection: string, options: Record<string, unknown> = {}) =>
          call({
            op: 'oauth',
            method: 'connect',
            connection,
            returnTo: options.returnTo,
            authorizeParams: options.authorizeParams,
            owner: options.owner
          }),
        status: (connection: string, options: Record<string, unknown> = {}) =>
          call({ op: 'oauth', method: 'status', connection, owner: options.owner }),
        disconnect: (connection: string, options: Record<string, unknown> = {}) =>
          call({ op: 'oauth', method: 'disconnect', connection, owner: options.owner }),
        token: (connection: string, options: Record<string, unknown> = {}) =>
          call({ op: 'oauth', method: 'token', connection, owner: options.owner }),
        callbackUrl: () => call({ op: 'oauth', method: 'callbackUrl' }),
        fetch: async (connection: string, url: string | URL, init: Record<string, unknown> = {}) => {
          const { owner, ...rest } = init;
          const answer = await cuttable({ op: 'oauth', method: 'fetch', connection, url: String(url), owner }, rest);

          return responseOf(isRecord(answer) ? answer : {});
        }
      },
      log,
      emit: (chunk: unknown) => {
        call({ op: 'emit', chunk }).catch(() => undefined);
      },
      signal
    };
  };

  const STOPS = ['pause', 'cancel', 'limit', 'shutdown'];

  /**
   * Why the slice is asked to end, once it is: the reason the signal was aborted with — said as itself in a runtime, and
   * as the message of the `AbortError` the sandbox raises — and a cancel when it said none of them.
   */
  const stoppingOf = (): string | undefined => {
    const current: unknown = signal;
    if (typeof current !== 'object' || current === null || !('aborted' in current) || current.aborted !== true) {
      return undefined;
    }

    const reason: unknown = 'reason' in current ? current.reason : undefined;
    const said =
      typeof reason === 'string'
        ? reason
        : typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string'
          ? reason.message
          : undefined;

    return said !== undefined && STOPS.includes(said) ? said : 'cancel';
  };

  /** A job's `run` and what it is handed: the slice, how it saves and reports, and why it is asked to end. */
  const runJob = async (found: Record<string, unknown>, invocation: Record<string, unknown>, ctx: unknown) => {
    const jobs = isRecord(found.jobs) ? found.jobs : {};
    const name = String(invocation.name);
    const job = Object.hasOwn(jobs, name) ? jobs[name] : undefined;
    if (!isRecord(job) || !isCallable(job.run)) {
      throw new Error(`This space's functions have no job "${name}"`);
    }

    const slice = isRecord(invocation.job) ? invocation.job : {};
    const handle = {
      id: slice.id,
      name,
      state: slice.state,
      attempt: slice.attempt,
      save: async (state: unknown) => {
        await call({ op: 'job', method: 'save', state });
      },
      report: (fraction: number, step?: string) => {
        call({ op: 'job', method: 'report', fraction, step }).catch(() => undefined);
      },
      get stopping() {
        return stoppingOf();
      },
      signal
    };
    const value: unknown = await job.run(isRecord(invocation.input) ? invocation.input : {}, handle, ctx);

    return value === undefined ? null : value;
  };

  /** One invocation: what a task or a job's slice returned (`null` for nothing), or the wire response a route answered. */
  const invoke = async (definition: unknown, invocation: Record<string, unknown>): Promise<unknown> => {
    const found = isRecord(definition) ? definition : {};
    const ctx = contextOf(invocation);
    if (invocation.kind === 'job') {
      return runJob(found, invocation, ctx);
    }

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
