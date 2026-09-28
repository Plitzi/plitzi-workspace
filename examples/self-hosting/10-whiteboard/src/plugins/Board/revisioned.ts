/**
 * A map that counts its own changes: what the canvas keys what it caches on, so a frame that changed nothing reuses
 * what the last one worked out — the elements as they are drawn, the picture of the board — instead of working it out
 * again for every one of four thousand elements on every pointer move.
 *
 * Always made empty: `Map`'s constructor adds its entries through `set` before a subclass's own fields exist.
 */
export class RevisionedMap<K, V> extends Map<K, V> {
  /** Every change: a value set, a key gone. */
  revision = 0;
  /** Only the changes to WHICH keys it holds — what a dragged element's every step leaves as it was. */
  membership = 0;

  override set(key: K, value: V): this {
    this.revision += 1;
    if (!this.has(key)) {
      this.membership += 1;
    }

    return super.set(key, value);
  }

  override delete(key: K): boolean {
    const removed = super.delete(key);
    if (removed) {
      this.revision += 1;
      this.membership += 1;
    }

    return removed;
  }

  override clear(): void {
    if (this.size) {
      this.revision += 1;
      this.membership += 1;
    }

    super.clear();
  }
}

/** The same, for a set: the selection, which decides how every selected element is drawn. */
export class RevisionedSet<T> extends Set<T> {
  revision = 0;

  override add(value: T): this {
    if (!this.has(value)) {
      this.revision += 1;
    }

    return super.add(value);
  }

  override delete(value: T): boolean {
    const removed = super.delete(value);
    if (removed) {
      this.revision += 1;
    }

    return removed;
  }

  override clear(): void {
    if (this.size) {
      this.revision += 1;
    }

    super.clear();
  }
}
