/**
 * The person's credential as the page hands it to the builder now (`userKey`), read when a request leaves rather than
 * when the client was made. The page renews it — a tab back after its token's life — and a request refused meanwhile
 * waits for the new one ({@link Credential.next}) to be asked again.
 */
export type Credential = {
  readonly current: string;
  set: (value: string) => void;
  /** The credential once it is no longer `previous` — or the current one, unchanged, after `waitMs`. */
  next: (previous: string, waitMs: number) => Promise<string>;
};

export const createCredential = (initial: string): Credential => {
  let current = initial;
  const waiting = new Set<() => void>();

  return {
    get current() {
      return current;
    },
    set: value => {
      if (value === current) {
        return;
      }

      current = value;
      for (const wake of [...waiting]) {
        wake();
      }
    },
    next: async (previous, waitMs) => {
      if (current !== previous) {
        return current;
      }

      await new Promise<void>(resolve => {
        const done = () => {
          clearTimeout(timer);
          waiting.delete(done);
          resolve();
        };
        const timer = setTimeout(done, waitMs);
        waiting.add(done);
      });

      return current;
    }
  };
};
