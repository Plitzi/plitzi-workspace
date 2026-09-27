/**
 * What the workers of one server say to their primary, and it to them — with nothing here that knows about
 * `node:cluster`, so the rules can be held by tests in one process.
 *
 * Two things cross it:
 *
 * - **Calls to a store the primary holds.** A default kept in memory — an action's `kv`, the job queue, the drafts a
 *   preview reads, the sign-in rate limit — is right for one process and wrong for several: a counter that counts
 *   one worker's requests, a schedule every worker fires. With workers, the primary keeps the one copy and each
 *   worker calls it. One process answering them in turn is what makes `increment` atomic across the fleet.
 * - **Broadcasts.** What one process is told — invalidate this page, forget that plugin — reaches every other.
 *   Nothing answers a broadcast, so what is sent must be safe to apply twice.
 */

export type FleetCall = { sdkFleet: 'call'; id: number; store: string; method: string; args: unknown[] };

export type FleetReply =
  | { sdkFleet: 'reply'; id: number; ok: true; value: unknown }
  | { sdkFleet: 'reply'; id: number; ok: false; error: string };

export type FleetBroadcast = { sdkFleet: 'broadcast'; channel: string; payload: unknown };

export type FleetMessage = FleetCall | FleetReply | FleetBroadcast;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The channel is shared with `node:cluster` and anything else the deployment sends: only these are ours. */
export const isFleetMessage = (value: unknown): value is FleetMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.sdkFleet === 'call') {
    return (
      typeof value.id === 'number' &&
      typeof value.store === 'string' &&
      typeof value.method === 'string' &&
      Array.isArray(value.args)
    );
  }

  if (value.sdkFleet === 'reply') {
    return typeof value.id === 'number' && typeof value.ok === 'boolean';
  }

  if (value.sdkFleet === 'broadcast') {
    return typeof value.channel === 'string';
  }

  return false;
};

/** A store as a worker sees it: every method answers later, since the answer comes from another process. */
export type Remote<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never;
};

/** Every method of a store, named: the key set is checked, so a method added to the store is not left unreachable. */
export type StoreMethods<T> = { [K in keyof T]-?: true };

/** How the primary makes a store the first time a worker asks for it, and the methods a worker may call on it. */
export type HostedStore = { create: () => object; methods: ReadonlySet<string> };

export const hostable = <T extends object>(create: () => T, methods: StoreMethods<T>): HostedStore => ({
  create,
  methods: new Set(Object.keys(methods))
});

/**
 * The primary's side: the stores it keeps for its workers, answering their calls.
 *
 * A worker names a store `<kind>#<n>` — the n-th of that kind its code built, the same in every worker since they
 * all run the same code — and the primary makes it from the catalogue the first time it is asked. Nothing is made
 * that no worker uses. A call names a method the kind was registered with and nothing else: the channel is not a way
 * to reach whatever the object happens to carry.
 */
export const createStoreHost = (catalogue: Readonly<Record<string, HostedStore>>) => {
  const instances = new Map<string, { instance: object; methods: ReadonlySet<string> }>();

  const storeFor = (key: string) => {
    const existing = instances.get(key);
    if (existing) {
      return existing;
    }

    const kind = key.slice(0, key.lastIndexOf('#'));
    if (!Object.hasOwn(catalogue, kind)) {
      return undefined;
    }

    const { create, methods } = catalogue[kind];
    const made = { instance: create(), methods };
    instances.set(key, made);

    return made;
  };

  const answer = async (call: FleetCall): Promise<FleetReply> => {
    const store = storeFor(call.store);
    const method: unknown = store?.methods.has(call.method) ? Reflect.get(store.instance, call.method) : undefined;
    if (!store || typeof method !== 'function') {
      return {
        sdkFleet: 'reply',
        id: call.id,
        ok: false,
        error: `the primary holds no store "${call.store}" with a method "${call.method}"`
      };
    }

    try {
      const value: unknown = await Reflect.apply(method, store.instance, call.args);

      return { sdkFleet: 'reply', id: call.id, ok: true, value };
    } catch (error) {
      return {
        sdkFleet: 'reply',
        id: call.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  return { answer };
};

export type StoreHost = ReturnType<typeof createStoreHost>;

/** Who in this process hears a broadcast, by channel. A listener that throws is the caller's to report. */
export const createListeners = (onError: (channel: string, error: unknown) => void) => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const listen = (channel: string, listener: (payload: unknown) => void): (() => void) => {
    const set = listeners.get(channel) ?? new Set();
    set.add(listener);
    listeners.set(channel, set);

    return () => set.delete(listener);
  };

  const deliver = (channel: string, payload: unknown): void => {
    listeners.get(channel)?.forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        onError(channel, error);
      }
    });
  };

  return { listen, deliver };
};

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/**
 * A worker's side: calls to the primary's stores, and broadcasts both ways.
 *
 * `send` may throw — a value that cannot cross the channel, a primary already gone — and the call then fails
 * rather than waiting for an answer that will not come. The same when the channel closes with calls in flight.
 */
export const createFleetClient = (
  send: (message: FleetMessage) => void,
  deliver: (channel: string, payload: unknown) => void
) => {
  const pending = new Map<number, Pending>();
  let nextId = 0;
  let closed = false;

  const call = (store: string, method: string, args: unknown[]): Promise<unknown> => {
    if (closed) {
      return Promise.reject(new Error(`[fleet] ${store}.${method}: the primary is gone`));
    }

    nextId += 1;
    const id = nextId;

    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        send({ sdkFleet: 'call', id, store, method, args });
      } catch (error) {
        pending.delete(id);
        reject(new Error(`[fleet] ${store}.${method} could not be sent to the primary`, { cause: error }));
      }
    });
  };

  /** Every method of the store, each a call to the copy the primary keeps. */
  const remote = <T extends object>(store: string, methods: StoreMethods<T>): Remote<T> =>
    // The keys are T's own (StoreMethods<T> requires every one), and each is replaced by a function that answers
    // what T's method answers, a turn later; TypeScript cannot follow that through Object.fromEntries.
    Object.fromEntries(
      Object.keys(methods).map(method => [method, (...args: unknown[]) => call(store, method, args)])
    ) as Remote<T>;

  const broadcast = (channel: string, payload: unknown): void => {
    if (!closed) {
      send({ sdkFleet: 'broadcast', channel, payload });
    }
  };

  const receive = (message: FleetMessage): void => {
    if (message.sdkFleet === 'reply') {
      const waiting = pending.get(message.id);
      pending.delete(message.id);
      if (message.ok) {
        waiting?.resolve(message.value);
      } else {
        waiting?.reject(new Error(`[fleet] ${message.error}`));
      }

      return;
    }

    if (message.sdkFleet === 'broadcast') {
      deliver(message.channel, message.payload);
    }
  };

  const close = (): void => {
    closed = true;
    const waiting = [...pending.values()];
    pending.clear();
    waiting.forEach(entry => entry.reject(new Error('[fleet] the primary is gone')));
  };

  return { call, remote, broadcast, receive, close };
};

export type FleetClient = ReturnType<typeof createFleetClient>;

export type FleetPeer = { id: number; send: (message: FleetMessage) => void };

/**
 * The primary's side of the channel: it answers its workers' calls from the stores it holds, and passes each
 * broadcast on to every process that did not send it — itself included, so a server in the primary hears it too.
 *
 * A peer that went away between a call and its answer is simply not answered: it is not waiting any more.
 */
export const createFleetHub = ({
  host,
  deliver,
  peers
}: {
  host: StoreHost;
  deliver: (channel: string, payload: unknown) => void;
  peers: () => FleetPeer[];
}) => {
  const sendTo = (peer: FleetPeer | undefined, message: FleetMessage): void => {
    try {
      peer?.send(message);
    } catch {
      // Gone since it was listed: whatever it was owed, it no longer needs.
    }
  };

  const broadcast = (channel: string, payload: unknown, except?: number): void => {
    peers()
      .filter(peer => peer.id !== except)
      .forEach(peer => sendTo(peer, { sdkFleet: 'broadcast', channel, payload }));
  };

  const receive = async (from: number, message: FleetMessage): Promise<void> => {
    if (message.sdkFleet === 'call') {
      const reply = await host.answer(message);
      sendTo(
        peers().find(peer => peer.id === from),
        reply
      );

      return;
    }

    if (message.sdkFleet === 'broadcast') {
      deliver(message.channel, message.payload);
      broadcast(message.channel, message.payload, from);
    }
  };

  return { receive, broadcast };
};

export type FleetHub = ReturnType<typeof createFleetHub>;
