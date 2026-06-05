export type AnyListener = (...args: never[]) => void;

// A removed-while-notifying slot. Calling it is a harmless no-op, so the notify loop never has to branch.
const TOMBSTONE: AnyListener = () => {};

// A listener list that is safe to mutate from inside its own notification. A removal during an active notify can't
// be a swap-pop (that reorders the array the loop is walking, skipping or double-calling a sibling); instead the
// slot is tombstoned and the array is compacted once the outermost notify ends. Outside a notify, removal is a plain
// O(1) swap-pop and iteration is a tight indexed loop — no copy, no allocation on the hot path.
class Subscribers<F extends AnyListener> {
  readonly items: F[] = [];
  private notifying = 0;
  private dead = 0;

  get length(): number {
    return this.items.length - this.dead;
  }

  add(listener: F): () => void {
    this.items.push(listener);

    return () => this.remove(listener);
  }

  remove(listener: F): void {
    const idx = this.items.indexOf(listener);
    if (idx === -1) {
      return;
    }

    if (this.notifying > 0) {
      this.items[idx] = TOMBSTONE as F;
      this.dead++;

      return;
    }

    const last = this.items.pop() as F;
    if (idx < this.items.length) {
      this.items[idx] = last;
    }
  }

  begin(): void {
    this.notifying++;
  }

  end(): void {
    if (--this.notifying === 0 && this.dead > 0) {
      this.compact();
    }
  }

  forEach(cb: (listener: F) => void): void {
    this.begin();
    try {
      const { items } = this;
      // Snapshot the count: a listener added during this pass isn't called until the next notify (and a removed one
      // is a tombstone we call as a no-op), matching the React/Redux subscription contract.
      for (let i = 0, n = items.length; i < n; i++) {
        cb(items[i]);
      }
    } finally {
      this.end();
    }
  }

  clear(): void {
    this.items.length = 0;
    this.notifying = 0;
    this.dead = 0;
  }

  private compact(): void {
    const { items } = this;
    let write = 0;
    for (let read = 0; read < items.length; read++) {
      if (items[read] !== TOMBSTONE) {
        items[write++] = items[read];
      }
    }

    items.length = write;
    this.dead = 0;
  }
}

export default Subscribers;
