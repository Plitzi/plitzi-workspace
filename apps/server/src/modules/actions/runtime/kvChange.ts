/** What a change needs of a store: read a key, and write it only if it still holds what was read. */
export type KvChangeStore<V> = {
  get: (key: string) => Promise<V | undefined>;
  swap: (key: string, expected: V | undefined, next: V, ttlSeconds?: number) => Promise<boolean>;
};

/**
 * The lifetime a change writes with: a number of seconds, one worked out from the value written, or none.
 */
export type KvChangeLifetime<T> = number | ((next: T) => number | undefined);

export type KvChangeOptions<T> = {
  lifetime?: KvChangeLifetime<T> | undefined;
  /**
   * The error a change that kept losing ends with — an `ActionRefusal` where there is one to make: being too busy is
   * something to tell whoever asked, not a fault. Handed in because this function may import nothing.
   */
  refusal: (message: string) => Error;
};

/**
 * Reads `key`, hands its value to `change`, and writes back what that answers — unless somebody wrote in between, and
 * then it reads again and asks again. `change` answering `undefined` writes nothing. Answers what was written, or
 * `undefined` when nothing was. Losing every time ends in `refusal`, whose message names no key: it is for a visitor.
 *
 * The one read-change-write there is: `ctx.kv.change`, a list's writes, and the sandbox's `ctx.kv.change` too — its
 * guest is handed THIS function's source (`isolate.ts`), so it must stay self-contained: no import, nothing of this
 * module's, only what the guest's globals also have (`setTimeout`, `Math`).
 */
export const changeKv = async <V, T extends V>(
  store: KvChangeStore<V>,
  key: string,
  change: (current: V | undefined) => T | undefined | Promise<T | undefined>,
  { lifetime, refusal }: KvChangeOptions<T>
): Promise<T | undefined> => {
  const attempts = 25;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.get(key);
    const next = await change(current);
    if (next === undefined) {
      return undefined;
    }

    if (await store.swap(key, current, next, typeof lifetime === 'function' ? lifetime(next) : lifetime)) {
      return next;
    }

    // Spread out, so the writers that lost to the same one do not all come back at the same instant.
    await new Promise(resolve => setTimeout(resolve, Math.random() * Math.min(5 + attempt * 5, 50)));
  }

  throw refusal('Many people are changing this at once — try again in a moment');
};
