export type DesktopUser = {
  id: number;
  username: string;
  email: string;
  verified?: boolean;
  roles?: string[];
  permissions?: string[];
};

export type StoredSession = {
  user: DesktopUser;
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  /**
   * The registration this session was granted to.
   *
   * Stored because a native client registers PER FLOW — the redirect it declares carries a loopback port the OS
   * picked at the time — so there is no fixed client id to renew with later. Without it a session can only be
   * replaced by signing in again.
   */
  clientId?: string;
};

export const nowInSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * How long before a token dies this app stops trusting it.
 *
 * A request that leaves with three seconds of life on it arrives expired, and the failure lands on whatever the
 * person was doing rather than on the renewal — so the window is wide enough to cover a slow network and a
 * refresh round trip, and no wider.
 */
export const RENEW_WINDOW_SECONDS = 60;

/** What a granted session becomes, once the person it belongs to has been looked up. */
export const toSession = (
  granted: { clientId: string; accessToken: string; refreshToken?: string; expiresIn?: number },
  user: DesktopUser
): StoredSession => ({
  user,
  accessToken: granted.accessToken,
  expiresAt: nowInSeconds() + (granted.expiresIn ?? 0),
  refreshToken: granted.refreshToken,
  clientId: granted.clientId
});

export const isUsable = (session: StoredSession | undefined, at = nowInSeconds()): boolean =>
  session !== undefined && session.expiresAt - RENEW_WINDOW_SECONDS > at;

/**
 * Whether there is still a way back to a live session without opening the browser again.
 *
 * There is no expiry to check: the grant's refresh token has a lifetime this app is never told, so the only
 * authority on whether it still works is the server. Having one is the question; a refusal ends the session.
 */
export const isRenewable = (session: StoredSession | undefined): boolean =>
  session?.refreshToken !== undefined && session.clientId !== undefined;

/**
 * A session read back from disk, or nothing.
 *
 * Everything that is not a session this app wrote answers the same way, for the same reason the store itself
 * does: a version of the app that stored a different shape, a truncated file, a value from another machine all
 * mean "sign in again", and giving them separate error states would only invent failures nobody can act on.
 */
export const parseSession = (raw: string | undefined): StoredSession | undefined => {
  if (!raw) {
    return undefined;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }

  const candidate = value as Partial<StoredSession> | null;
  if (
    !candidate ||
    typeof candidate.accessToken !== 'string' ||
    typeof candidate.expiresAt !== 'number' ||
    typeof candidate.user?.id !== 'number'
  ) {
    return undefined;
  }

  return candidate as StoredSession;
};

export const serializeSession = (session: StoredSession): string => JSON.stringify(session);
