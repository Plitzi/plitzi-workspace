import { createStore } from '@plitzi/nexus';

import type { StoreApi } from '@plitzi/nexus';

/** How long, by default, an answer nobody is rendering is kept, so coming back within it still paints at once. */
export const GC_TIME = 5 * 60 * 1000;

/** What a query is about, for the invalidations that pick queries by what they read rather than by key. */
export type QueryMeta = { url: string };

/** One query as the store holds it: what a hook renders from and what the dev-tools show. */
export type QueryEntry = {
  key: string;
  url: string;
  data?: unknown;
  error?: unknown;
  isFetching: boolean;
};

export type QueriesState = { entries: Partial<Record<string, QueryEntry>> };

export type QueryObserverOptions<T> = {
  meta: QueryMeta;
  fetcher: () => Promise<T>;
  /** How long an answer counts as current, in milliseconds. `0` asks again on every mount. */
  staleTime: number;
  /** An answer this rejects is shown but never trusted: the next observer to mount asks again. */
  isCacheable?: (data: T) => boolean;
};

type Observer = QueryObserverOptions<unknown>;

/** What a query needs besides its state — who is looking at it, and the request already out. Nothing renders it. */
type Runtime = {
  key: string;
  observers: Set<Observer>;
  /** Mounted readers, enabled or not: a provider in a hidden tab still shows what it holds when the tab opens. */
  holds: number;
  inFlight?: Promise<void>;
  /** Bumped by every invalidation, so an answer to a request sent before one is known to be outdated. */
  version: number;
  /** How long the entry outlives its last reader; `0` forgets it the moment nobody renders it. */
  gcTime: number;
  gcTimer?: ReturnType<typeof setTimeout>;
};

/**
 * One path segment per key.
 *
 * A key carries a URL, and a URL is full of dots — the store's path separator — so the key cannot be the segment
 * itself. cyrb53: 53 bits keep a collision out of reach for the queries one page makes, and the entry stores its
 * full key besides, so a collision would read as a miss rather than as somebody else's answer.
 */
export const queryId = (key: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export const queryPath = (key: string) => `entries.${queryId(key)}` as const;

/**
 * Answers to read requests, shared by everything that asks the same question — modelled on react-query.
 *
 * An answer is served while it is fresh, served AND asked again in the background once it is stale, and asked again
 * at once when something says the data behind it changed. The answers live in a nexus store written with the TTL of
 * whoever asked, so "is this still good?" is the store's own `isStale`, and the dev-tools show exactly what is held.
 *
 * A query is "active" while an enabled observer renders it. A provider inside a hidden tab is mounted but not active,
 * so an invalidation marks its answer stale and it asks when it is shown again, not for a branch nobody sees.
 *
 * Memory only, and module-scoped like the action-runs store: the page's own session is the only one it can hold, and
 * {@link QueryCache.reset} is how a change of session makes sure nothing of the previous one is ever served. Nothing
 * fills it during a server render — observers attach in effects.
 */
export class QueryCache {
  readonly store: StoreApi<QueriesState>;

  private runtimes = new Map<string, Runtime>();

  /** Bumped by {@link reset}: an answer carrying an older epoch belongs to a session that has ended. */
  private epochValue = 0;

  private unwatch: (() => void) | undefined;

  constructor(store: StoreApi<QueriesState> = createStore<QueriesState>({ entries: {} }, { id: 'queries' })) {
    this.store = store;
  }

  get epoch(): number {
    return this.epochValue;
  }

  /** The entry for `key`; a different key that hashed to the same segment is not it. */
  getEntry(key: string): QueryEntry | undefined {
    const entry = this.store.getPath(queryPath(key));

    return entry?.key === key ? entry : undefined;
  }

  /** Whether `key` has been answered in this session — every answer is written with a TTL, even a distrusted one. */
  hasAnswer(key: string): boolean {
    return this.getEntry(key) !== undefined && this.store.getFreshness(queryPath(key)) !== undefined;
  }

  /**
   * Keeps `key` from being collected for as long as the returned function is not called, and for `gcTime` after.
   * The latest reader's `gcTime` is the one kept.
   */
  hold(key: string, gcTime = GC_TIME): () => void {
    const runtime = this.ensure(key);
    runtime.gcTime = gcTime;
    runtime.holds++;
    this.cancelGc(runtime);

    return () => {
      runtime.holds--;
      this.scheduleGc(runtime);
    };
  }

  /** Makes `key` active for as long as the returned function is not called, asking for it if it is not current. */
  observe<T>(key: string, options: QueryObserverOptions<T>): () => void {
    const runtime = this.ensure(key);
    const { isCacheable } = options;
    const observer: Observer = {
      meta: options.meta,
      staleTime: options.staleTime,
      fetcher: options.fetcher,
      // Called only with what `options.fetcher` resolved to. The store holds every query of the page, so it cannot
      // carry each one's type; the caller's `T` is the one it put there.
      isCacheable: isCacheable && (data => isCacheable(data as T))
    };
    runtime.observers.add(observer);
    this.cancelGc(runtime);

    if (!this.hasAnswer(key) || this.store.isStale(queryPath(key))) {
      void this.fetch(runtime, observer);
    }

    return () => {
      runtime.observers.delete(observer);
      this.scheduleGc(runtime);
    };
  }

  /** Asks again for `key` now, whatever the age of what is held — the explicit "reload this". */
  refetch(key: string): Promise<void> {
    const runtime = this.runtimes.get(queryId(key));

    return runtime ? this.invalidateOne(runtime) : Promise.resolve();
  }

  /**
   * Marks every query `matches` accepts (all of them without one) as stale, and asks again for the active ones.
   *
   * The inactive ones keep what they hold and ask when they are next shown, which is the whole saving: a write does
   * not turn into a request for every provider on every tab the visitor is not looking at.
   */
  invalidate(matches?: (meta: QueryMeta) => boolean): Promise<void> {
    const pending: Promise<void>[] = [];
    this.runtimes.forEach(runtime => {
      const entry = this.getEntry(runtime.key);
      if (!entry || (matches && !matches({ url: entry.url }))) {
        return;
      }

      pending.push(this.invalidateOne(runtime));
    });

    return Promise.all(pending).then(() => undefined);
  }

  /**
   * Forgets every answer, for a change of who is looking.
   *
   * Invalidating would not do: a stale query still SHOWS what it holds until the new answer lands, and what it holds
   * belongs to the previous visitor. The epoch makes a request still in flight from before land nowhere.
   */
  reset(): Promise<void> {
    this.epochValue++;
    this.runtimes.forEach(runtime => {
      runtime.version++;
      runtime.inFlight = undefined;
    });
    this.store.setState('entries', {});

    const pending: Promise<void>[] = [];
    this.runtimes.forEach(runtime => pending.push(this.fetchActive(runtime)));

    return Promise.all(pending).then(() => undefined);
  }

  /**
   * Expiring the path is the invalidation: {@link onExpired} does the rest, for this call and for anybody else who
   * expires a query's path — the dev-tools' "Expire" included. A query that has never answered has no record to
   * expire, so it is marked outdated here, which is what makes a request already out be asked again.
   */
  private invalidateOne(runtime: Runtime): Promise<void> {
    if (this.store.expire(queryPath(runtime.key)).length === 0) {
      runtime.version++;
    }

    return this.fetchActive(runtime);
  }

  /** A query's path was expired: whatever is out now answers from before it, and whoever is looking asks again. */
  private onExpired(path: string) {
    const runtime = this.runtimes.get(path.slice('entries.'.length).split('.')[0]);
    if (!runtime) {
      return;
    }

    runtime.version++;
    void this.fetchActive(runtime);
  }

  private fetchActive(runtime: Runtime): Promise<void> {
    const active = runtime.observers.values().next();

    return active.done ? Promise.resolve() : this.fetch(runtime, active.value);
  }

  private fetch(runtime: Runtime, observer: Observer): Promise<void> {
    if (runtime.inFlight) {
      // The request already out answers this one, unless it was sent before an invalidation — then its answer is
      // stale on arrival and `settle` asks again, so there is only ever one request out per key.
      return runtime.inFlight;
    }

    const { key } = runtime;
    const { url } = observer.meta;
    const path = queryPath(key);
    const held = this.getEntry(key);
    // Below the entry when there is one: a write over it would drop the freshness record of the answer it holds.
    if (held) {
      this.store.setState(`${path}.isFetching`, true);
    } else {
      this.store.setState(path, { key, url, isFetching: true });
    }

    const epoch = this.epochValue;
    const version = runtime.version;
    const settle = (outcome: { data: unknown } | { error: unknown }): Promise<void> => {
      if (epoch !== this.epochValue || this.runtimes.get(queryId(key)) !== runtime) {
        return Promise.resolve();
      }

      runtime.inFlight = undefined;
      const outdated = version !== runtime.version;
      if ('error' in outcome) {
        // Written with no life at all: what was held stays on screen, and the next observer asks again.
        const previous = this.getEntry(key);
        this.store.setState(
          path,
          { key, url, data: previous?.data, error: outcome.error, isFetching: false },
          { ttl: 0 }
        );
      } else {
        const trusted = !outdated && (observer.isCacheable?.(outcome.data) ?? true);
        this.store.setState(
          path,
          { key, url, data: outcome.data, isFetching: false },
          { ttl: trusted ? this.ttlOf(runtime, observer) : 0 }
        );
      }

      return outdated ? this.fetchActive(runtime) : Promise.resolve();
    };

    runtime.inFlight = observer.fetcher().then(
      data => settle({ data }),
      (error: unknown) => settle({ error })
    );

    return runtime.inFlight;
  }

  /** The strictest TTL among those rendering the query, so no observer is served an answer older than it accepts. */
  private ttlOf(runtime: Runtime, fallback: Observer): number {
    let ttl = runtime.observers.size > 0 ? Infinity : fallback.staleTime;
    runtime.observers.forEach(observer => {
      ttl = Math.min(ttl, observer.staleTime);
    });

    return ttl;
  }

  private ensure(key: string): Runtime {
    const id = queryId(key);
    let runtime = this.runtimes.get(id);
    if (!runtime) {
      runtime = { key, observers: new Set(), holds: 0, version: 0, gcTime: GC_TIME };
      this.runtimes.set(id, runtime);
    }

    // Listening starts with the first query, so a module that is only imported — a server render — arms nothing.
    this.unwatch ??= this.store.watchFreshness('entries', event => {
      if (event.type === 'expired') {
        this.onExpired(event.path);
      }
    });

    return runtime;
  }

  private cancelGc(runtime: Runtime) {
    clearTimeout(runtime.gcTimer);
    runtime.gcTimer = undefined;
  }

  private scheduleGc(runtime: Runtime) {
    if (runtime.holds > 0 || runtime.observers.size > 0) {
      return;
    }

    this.cancelGc(runtime);
    if (runtime.gcTime <= 0) {
      this.collect(runtime);

      return;
    }

    runtime.gcTimer = setTimeout(() => this.collect(runtime), runtime.gcTime);
  }

  private collect(runtime: Runtime) {
    const id = queryId(runtime.key);
    if (this.runtimes.get(id) === runtime && runtime.holds === 0 && runtime.observers.size === 0) {
      this.runtimes.delete(id);
      this.store.setState(queryPath(runtime.key), undefined, { unmount: true });
    }
  }
}

const queryCache = new QueryCache();

export default queryCache;
