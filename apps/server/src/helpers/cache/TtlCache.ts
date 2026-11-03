import { DEFAULT_TTL_MS } from './defaults';

type Segment = 'probation' | 'protected';

type Entry<T> = { value: T; storedAt: number; bytes: number; segment: Segment };

/** A segment's entries, least recently used first (a Map keeps the order of insertion; a use re-inserts). */
type Lane = { keys: Map<string, true>; bytes: number };

export type TtlCacheOptions<T> = {
  /**
   * What the cache holds at most, in bytes as `sizeOf` measures them. Without one, only the entry count bounds it —
   * which is no bound at all on entries of a megabyte each.
   */
  maxBytes?: number;
  sizeOf?: (value: T) => number;
  /** How long past its TTL an entry is still handed out by {@link TtlCache.read}, marked stale. */
  staleMs?: number;
  sweepIntervalMs?: number;
};

/** An entry, and whether its TTL has passed — a stale one is still within the window `staleMs` keeps it for. */
export type CacheRead<T> = { value: T; stale: boolean; storedAt: number };

/** What of the cache the entries used more than once may hold: the rest is where new ones prove themselves. */
const PROTECTED_SHARE = 0.8;

/**
 * A map whose entries expire, bounded by count and by bytes — a segmented LRU.
 *
 * An entry starts on probation and is protected once it is used again. When the cache is full, probation gives way
 * first, its least recently used entry first, and only then the protected entry used longest ago; protected entries
 * past their share go back to probation. So what was asked for once — a page of a space barely visited, every URL a
 * crawler made up — never pushes out what is asked for all the time, whichever space it is of: a space that just got
 * busy earns its room from the ones that went quiet, and a burst of one-off pages only displaces itself.
 *
 * Least recently USED, not least recently stored: the first version dropped the oldest entry whatever it was, so the
 * site's home page — stored first and served on every visit — was the one evicted when the cache filled.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private readonly lanes: Record<Segment, Lane> = {
    probation: { keys: new Map(), bytes: 0 },
    protected: { keys: new Map(), bytes: 0 }
  };
  private readonly maxBytes: number;
  private readonly sizeOf: ((value: T) => number) | undefined;
  private readonly staleMs: number;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS.html,
    private readonly maxSize = 500,
    { maxBytes = Infinity, sizeOf, staleMs = 0, sweepIntervalMs = ttlMs }: TtlCacheOptions<T> = {}
  ) {
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf;
    this.staleMs = staleMs;
    this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
    (this.sweepTimer as unknown as { unref?: () => void }).unref?.();
  }

  /** The entry while its TTL lasts. */
  get(key: string): T | undefined {
    const read = this.read(key);

    return read && !read.stale ? read.value : undefined;
  }

  /** The entry while its TTL lasts, and after it for `staleMs`, saying which. A read is a use: see the class. */
  read(key: string): CacheRead<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    const age = Date.now() - entry.storedAt;
    if (age > this.ttlMs + this.staleMs) {
      this.remove(key, entry);

      return undefined;
    }

    this.place(key, entry, 'protected');
    this.keepProtectedToShare(key);

    return { value: entry.value, stale: age > this.ttlMs, storedAt: entry.storedAt };
  }

  /**
   * `storedAt` for an entry that was made before it reached this cache — read from a store several processes share.
   * An entry stored again (rendered again once it expired) keeps the standing it had.
   */
  set(key: string, value: T, storedAt = Date.now()): void {
    const previous = this.store.get(key);
    if (previous) {
      this.remove(key, previous);
    }

    const bytes = this.sizeOf?.(value) ?? 0;
    // One entry larger than the whole budget would empty the cache to make room and still not fit.
    if (bytes > this.maxBytes) {
      return;
    }

    const entry: Entry<T> = { value, storedAt, bytes, segment: previous?.segment ?? 'probation' };
    this.store.set(key, entry);
    this.place(key, entry, entry.segment);
    this.keepProtectedToShare(key);

    while (this.store.size > this.maxSize || this.bytes > this.maxBytes) {
      if (!this.evictOne(key)) {
        break;
      }
    }
  }

  delete(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      this.remove(key, entry);
    }
  }

  invalidateWhere(predicate: (key: string) => boolean): number {
    let count = 0;
    for (const [key, entry] of this.store) {
      if (predicate(key)) {
        this.remove(key, entry);
        count++;
      }
    }

    return count;
  }

  clear(): void {
    this.store.clear();
    for (const lane of Object.values(this.lanes)) {
      lane.keys.clear();
      lane.bytes = 0;
    }
  }

  destroy(): void {
    clearInterval(this.sweepTimer);
    this.clear();
  }

  get size(): number {
    return this.store.size;
  }

  get bytes(): number {
    return this.lanes.probation.bytes + this.lanes.protected.bytes;
  }

  /** Whether an entry has been used since it was stored — what keeps it when the cache needs room. */
  isProtected(key: string): boolean {
    return this.store.get(key)?.segment === 'protected';
  }

  /** Moves an entry to the most recently used end of a segment. */
  private place(key: string, entry: Entry<T>, segment: Segment): void {
    const from = this.lanes[entry.segment];
    if (from.keys.delete(key)) {
      from.bytes -= entry.bytes;
    }

    entry.segment = segment;
    const to = this.lanes[segment];
    to.keys.set(key, true);
    to.bytes += entry.bytes;
  }

  /** Protected entries past their share go back to probation, the one used longest ago first — never `kept`. */
  private keepProtectedToShare(kept: string): void {
    const lane = this.lanes.protected;
    while (
      lane.keys.size > 1 &&
      (lane.bytes > this.maxBytes * PROTECTED_SHARE || lane.keys.size > this.maxSize * PROTECTED_SHARE)
    ) {
      const [oldest] = lane.keys.keys();
      const entry = this.store.get(oldest);
      if (oldest === kept || !entry) {
        break;
      }

      this.place(oldest, entry, 'probation');
    }
  }

  /** Drops one entry to make room — probation's least recently used, else the protected one used longest ago. */
  private evictOne(kept: string): boolean {
    for (const lane of [this.lanes.probation, this.lanes.protected]) {
      for (const key of lane.keys.keys()) {
        const entry = this.store.get(key);
        if (key !== kept && entry) {
          this.remove(key, entry);

          return true;
        }
      }
    }

    return false;
  }

  private remove(key: string, entry: Entry<T>): void {
    this.store.delete(key);
    const lane = this.lanes[entry.segment];
    if (lane.keys.delete(key)) {
      lane.bytes -= entry.bytes;
    }
  }

  private sweep(): void {
    const oldest = Date.now() - this.ttlMs - this.staleMs;
    for (const [key, entry] of this.store) {
      if (entry.storedAt < oldest) {
        this.remove(key, entry);
      }
    }
  }
}
