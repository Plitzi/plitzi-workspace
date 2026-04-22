type Entry<T> = { value: T; expiresAt: number };

export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly ttlMs: number = DEFAULT_CACHE_TTL_MS,
    private readonly maxSize = 500,
    sweepIntervalMs = ttlMs
  ) {
    this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
    (this.sweepTimer as unknown as { unref?: () => void }).unref?.();
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxSize) {
      this.store.delete(this.store.keys().next().value as string);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidateWhere(predicate: (key: string) => boolean): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (predicate(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  destroy(): void {
    clearInterval(this.sweepTimer);
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
