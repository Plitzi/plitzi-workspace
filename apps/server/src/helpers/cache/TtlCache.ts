import { DEFAULT_TTL_MS } from './defaults';

type Entry<T> = { value: T; storedAt: number; bytes: number };

export type TtlCacheOptions<T> = {
  /**
   * What the cache holds at most, in bytes as `sizeOf` measures them: the least recently used goes first. Without one,
   * only the entry count bounds it — which is no bound at all on entries of a megabyte each.
   */
  maxBytes?: number;
  sizeOf?: (value: T) => number;
  /** How long past its TTL an entry is still handed out by {@link TtlCache.read}, marked stale. */
  staleMs?: number;
  sweepIntervalMs?: number;
};

/** An entry, and whether its TTL has passed — a stale one is still within the window `staleMs` keeps it for. */
export type CacheRead<T> = { value: T; stale: boolean; storedAt: number };

/**
 * A map whose entries expire, bounded by count and by bytes, the least recently used dropped first.
 *
 * Least recently USED, not least recently stored: the first version dropped the oldest entry whatever it was, so the
 * site's home page — stored first and served on every visit — was the one evicted when the cache filled.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private readonly maxBytes: number;
  private readonly sizeOf: ((value: T) => number) | undefined;
  private readonly staleMs: number;
  private bytesHeld = 0;
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

  /** The entry while its TTL lasts, and after it for `staleMs`, saying which. */
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

    // Moved to the end: the Map's order is the order of use, and eviction takes from the front.
    this.store.delete(key);
    this.store.set(key, entry);

    return { value: entry.value, stale: age > this.ttlMs, storedAt: entry.storedAt };
  }

  /** `storedAt` for an entry that was made before it reached this cache — read from a store several processes share. */
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

    this.store.set(key, { value, storedAt, bytes });
    this.bytesHeld += bytes;

    for (const [oldest, entry] of this.store) {
      if (this.store.size <= this.maxSize && this.bytesHeld <= this.maxBytes) {
        break;
      }

      this.remove(oldest, entry);
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
    this.bytesHeld = 0;
  }

  destroy(): void {
    clearInterval(this.sweepTimer);
    this.clear();
  }

  get size(): number {
    return this.store.size;
  }

  get bytes(): number {
    return this.bytesHeld;
  }

  private remove(key: string, entry: Entry<T>): void {
    this.store.delete(key);
    this.bytesHeld -= entry.bytes;
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
