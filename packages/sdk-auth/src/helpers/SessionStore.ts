import type { Schema, TokenResult } from '@plitzi/sdk-shared';

export type StorageKind = Exclude<Schema['settings']['tokenStorage'], undefined>;

export type StoredSession<U> = {
  version: number;
  token?: TokenResult;
  user?: U;
  /**
   * Unix seconds of the last time the backend answered about this session — including the answer that nobody is
   * signed in. Storing the negative answer is what stops a signed-out visitor from paying for a request on every
   * single page load just to be told the same thing again.
   */
  validatedAt: number;
};

/** Bumped when the stored shape changes. An entry from a different version is dropped, never migrated: the cost of
 *  being wrong is one sign-in, and carrying readers for old shapes forever costs more than that. */
const VERSION = 1;

const isStoredSession = <U>(value: unknown): value is StoredSession<U> =>
  value !== null && typeof value === 'object' && (value as StoredSession<U>).version === VERSION;

/**
 * Where a session survives a reload. It holds the user next to the token on purpose: a token alone says a session is
 * live but not whose it is, so a page that stored only the token had to ask the backend who it was talking to before
 * it could render anything — which is the reason boot used to cost a round trip.
 */
class SessionStore<U> {
  private readonly kind: StorageKind;
  private readonly key: string;

  constructor(kind: StorageKind, key: string) {
    this.kind = kind;
    this.key = key;
  }

  private get area(): Storage | undefined {
    try {
      if (this.kind === 'localStorage' && typeof localStorage !== 'undefined') {
        return localStorage;
      }

      if (this.kind === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
        return sessionStorage;
      }
    } catch {
      // Storage access throws outright when the browser blocks it (private mode, third-party iframe). A session
      // that cannot be persisted still works for as long as the page lives, so this is a degradation, not a failure.
    }

    return undefined;
  }

  read(): StoredSession<U> | undefined {
    const raw = this.area?.getItem(this.key);
    if (!raw) {
      return undefined;
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      return isStoredSession<U>(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  write(session: Omit<StoredSession<U>, 'version'>): void {
    try {
      this.area?.setItem(this.key, JSON.stringify({ version: VERSION, ...session }));
    } catch {
      // Quota or a blocked area — see above.
    }
  }

  clear(): void {
    try {
      this.area?.removeItem(this.key);
    } catch {
      // See above.
    }
  }

  /**
   * Fires when another tab writes the session. Signing out in one tab has to end it in all of them, and a renewal in
   * one has to be adopted by the rest — two tabs that each renew on their own would rotate the refresh token out from
   * under each other, and whichever lost the race would sign its user out for no reason.
   */
  subscribe(listener: (session?: StoredSession<U>) => void): () => void {
    if (this.kind !== 'localStorage' || typeof window === 'undefined') {
      return () => undefined;
    }

    const handler = (event: StorageEvent) => {
      if (event.key !== null && event.key !== this.key) {
        return;
      }

      listener(this.read());
    };

    window.addEventListener('storage', handler);

    return () => window.removeEventListener('storage', handler);
  }
}

export default SessionStore;
