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
      // is a tombstone we call as a no-op). A throwing listener can't starve its siblings — the inner `for` stays a
      // tight walk and the `try` only re-enters on a throw — and the first error is re-raised once the pass ends.
      const n = items.length;
      let i = 0;
      let error: unknown;
      let thrown = false;
      while (i < n) {
        try {
          for (; i < n; i++) {
            cb(items[i]);
          }
        } catch (err) {
          if (!thrown) {
            thrown = true;
            error = err;
          }

          i++;
        }
      }

      if (thrown) {
        throw error;
      }
    } finally {
      this.end();
    }
  }

  clear(): void {
    // Clearing from inside a listener (e.g. `store.destroy()` mid-notification) must not truncate the array the
    // active loop is walking, nor reset `notifying` out from under the `begin`/`end` pair. Tombstone every slot
    // instead: remaining listeners become no-ops and the outermost `end()` compacts them away.
    if (this.notifying > 0) {
      const { items } = this;
      for (let i = 0, n = items.length; i < n; i++) {
        items[i] = TOMBSTONE as F;
      }

      this.dead = items.length;

      return;
    }

    this.items.length = 0;
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
