import type { SSRAdapters, SSRRequest, SSRSession, SSRUser } from '@plitzi/sdk-shared';

/**
 * The three adapters a page server asks about WHO a request carries, for a deployment that answers them itself.
 *
 * Separate from the space adapters on purpose: what a request renders and who is looking at it are two different
 * integrations, and a deployment routinely swaps one without touching the other. Composing them is a spread.
 *
 * A deployment running the auth kernel does not need this at all — `createAuth(...).ssrAdapters` answers the same
 * three, from the flows that mint and revoke the sessions. This is for the case with no kernel: a fixed user in a
 * test, a proxy that has already authenticated the request, or a store reached directly.
 */
export type AuthAdaptersConfig = {
  /** Who this request carries. A value for every request, or a function that reads the credential off one. */
  user?: SSRUser | ((req: SSRRequest) => SSRUser | undefined | Promise<SSRUser | undefined>);
  /** Verify credentials and mint a session. Return undefined to refuse; never throw for a wrong password. */
  authenticate?: (credentials: Record<string, string>, req: SSRRequest) => Promise<SSRSession | undefined>;
  /** Revoke the session this request carries, at the source. The cookies are the server's to clear. */
  endSession?: (req: SSRRequest) => Promise<void>;
};

export type AuthAdapters = Pick<SSRAdapters, 'getUser' | 'authenticate' | 'endSession'>;

export const createAuthAdapters = (config: AuthAdaptersConfig): AuthAdapters => {
  const { user, authenticate, endSession } = config;

  const getUser = user
    ? (req: SSRRequest): Promise<SSRUser | undefined> => Promise.resolve(typeof user === 'function' ? user(req) : user)
    : undefined;

  // Omitted rather than left undefined: a key that is present but empty overrides whatever else composed it in —
  // which is how a `getUser: undefined` from here would silently unwire a session the kernel had already answered.
  return {
    ...(getUser ? { getUser } : {}),
    ...(authenticate ? { authenticate } : {}),
    ...(endSession ? { endSession } : {})
  };
};
