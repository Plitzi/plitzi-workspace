export type DesktopUser = {
  id: number;
  username: string;
  email: string;
  verified?: boolean;
  roles?: string[];
  permissions?: string[];
};

/** The body `POST /auth/login`, `/auth/refresh` and `/auth/exchange` all answer with. */
export type AuthSuccess = {
  success: true;
  details: DesktopUser;
  access_token: string;
  expire_at: number;
  refresh_token?: string;
  refresh_expire_at?: number;
};

export type StoredSession = {
  user: DesktopUser;
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
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

export const toSession = (body: AuthSuccess): StoredSession => ({
  user: body.details,
  accessToken: body.access_token,
  expiresAt: body.expire_at,
  refreshToken: body.refresh_token,
  refreshExpiresAt: body.refresh_expire_at
});

export const isUsable = (session: StoredSession | undefined, at = nowInSeconds()): boolean =>
  session !== undefined && session.expiresAt - RENEW_WINDOW_SECONDS > at;

/** Whether there is still a way back to a live session without asking for the password again. */
export const isRenewable = (session: StoredSession | undefined, at = nowInSeconds()): boolean =>
  session?.refreshToken !== undefined && (session.refreshExpiresAt ?? 0) > at;

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
