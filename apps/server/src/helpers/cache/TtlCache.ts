import { DEFAULT_TTL_MS } from './defaults';

type Entry<T> = { value: T; storedAt: number; bytes: number; group: string };

/** One group's entries, least recently used first (a Map keeps the order of insertion; a use re-inserts). */
type Group = { keys: Map<string, true>; bytes: number };

export type TtlCacheOptions<T> = {
  /**
   * What the cache holds at most, in bytes as `sizeOf` measures them. Without one, only the entry count bounds it —
   * which is no bound at all on entries of a megabyte each.
   */
  maxBytes?: number;
  sizeOf?: (value: T) => number;
  /**
   * What an entry is shared out by — the space a page is of, on a server that renders many. When the cache is full it
   * is the group holding the most that gives way, its least recently used entry first: a space that fills the cache
   * (a burst of traffic, a crawler walking every query string) takes room the others are not using, and gives it back
   * the moment they need it. With one group — a server of one space, or no `groupOf` — it is plain LRU.
   */
  groupOf?: (key: string) => string;
  /** How long past its TTL an entry is still handed out by {@link TtlCache.read}, marked stale. */
  staleMs?: number;
  sweepIntervalMs?: number;
};

/** An entry, and whether its TTL has passed — a stale one is still within the window `staleMs` keeps it for. */
export type CacheRead<T> = { value: T; stale: boolean; storedAt: number };

/**
 * A map whose entries expire, bounded by count and by bytes, shared out fairly between groups.
 *
 * Least recently USED, not least recently stored: the first version dropped the oldest entry whatever it was, so the
 * site's home page — stored first and served on every visit — was the one evicted when the cache filled.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private readonly groups = new Map<string, Group>();
  private readonly maxBytes: number;
  private readonly sizeOf: ((value: T) => number) | undefined;
  private readonly groupOf: ((key: string) => string) | undefined;
  private readonly staleMs: number;
  private bytesHeld = 0;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS.html,
    private readonly maxSize = 500,
    { maxBytes = Infinity, sizeOf, groupOf, staleMs = 0, sweepIntervalMs = ttlMs }: TtlCacheOptions<T> = {}
  ) {
    this.maxBytes = maxBytes;
    this.sizeOf = sizeOf;
    this.groupOf = groupOf;
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

    const group = this.groups.get(entry.group);
    group?.keys.delete(key);
    group?.keys.set(key, true);

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

    const name = this.groupOf?.(key) ?? '';
    const group = this.groups.get(name) ?? { keys: new Map<string, true>(), bytes: 0 };
    this.groups.set(name, group);
    group.keys.set(key, true);
    group.bytes += bytes;
    this.store.set(key, { value, storedAt, bytes, group: name });
    this.bytesHeld += bytes;

    while (this.store.size > this.maxSize || this.bytesHeld > this.maxBytes) {
      const evicted = this.evictFromLargest(this.store.size > this.maxSize, key);
      if (!evicted) {
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
    this.groups.clear();
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

  /** What one group holds, in bytes. */
  bytesOf(group: string): number {
    return this.groups.get(group)?.bytes ?? 0;
  }

  /**
   * Drops the least recently used entry of the group that holds the most — by entries when that is what is over. Never
   * `kept`, the entry just stored: a group whose only entry it is gives way to the next.
   */
  private evictFromLargest(byCount: boolean, kept: string): boolean {
    let largest: Group | undefined;
    for (const group of this.groups.values()) {
      if (group.keys.size === 1 && group.keys.has(kept)) {
        continue;
      }

      const measure = byCount ? group.keys.size : group.bytes;
      if (!largest || measure > (byCount ? largest.keys.size : largest.bytes)) {
        largest = group;
      }
    }

    const oldest = largest?.keys.keys().next();
    const entry = oldest && !oldest.done ? this.store.get(oldest.value) : undefined;
    if (!oldest || oldest.done || !entry) {
      return false;
    }

    this.remove(oldest.value, entry);

    return true;
  }

  private remove(key: string, entry: Entry<T>): void {
    this.store.delete(key);
    this.bytesHeld -= entry.bytes;
    const group = this.groups.get(entry.group);
    if (!group) {
      return;
    }

    group.keys.delete(key);
    group.bytes -= entry.bytes;
    if (group.keys.size === 0) {
      this.groups.delete(entry.group);
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
