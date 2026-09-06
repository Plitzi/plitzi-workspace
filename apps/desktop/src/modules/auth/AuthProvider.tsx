import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAuthApi } from './authApi';
import AuthContext from './AuthContext';
import { isRenewable, isUsable, parseSession, serializeSession, toSession } from './session/session';
import useDesktop from '../desktop/useDesktop';

import type { SignupBody } from './authApi';
import type { AuthContextValue, LoginResult } from './AuthContext';
import type { StoredSession } from './session/session';
import type { ApiClient } from '@pmodules/network';
import type { ReactNode } from 'react';

export type AuthProviderProps = {
  children?: ReactNode;
  api: ApiClient;
};

const AuthProvider = ({ children, api }: AuthProviderProps) => {
  const desktop = useDesktop();
  const auth = useMemo(() => createAuthApi(api), [api]);
  const [session, setSession] = useState<StoredSession | undefined>(undefined);
  const [ready, setReady] = useState(false);
  /**
   * The live session, read by `getAccessToken` without re-creating it on every render.
   *
   * State alone is not enough: two requests firing in the same tick both read the state React rendered with, so
   * both would see the same expiring token and both would renew it — and the second renewal invalidates the
   * first's refresh token, signing the person out mid-click.
   */
  const current = useRef<StoredSession | undefined>(undefined);
  const renewal = useRef<Promise<StoredSession | undefined> | undefined>(undefined);

  const store = useCallback(
    async (next: StoredSession | undefined) => {
      current.current = next;
      setSession(next);
      await (next ? desktop.writeSession(serializeSession(next)) : desktop.clearSession());
    },
    [desktop]
  );

  /**
   * One renewal at a time, shared by everybody who asked while it was in flight.
   *
   * The refresh token is single-use — the server replaces it — so two concurrent refreshes race, and the loser
   * presents a token that no longer exists. Holding the promise makes the second caller wait for the first
   * answer, which is the one they both wanted.
   */
  const renew = useCallback(
    async (from: StoredSession): Promise<StoredSession | undefined> => {
      renewal.current ??= (async () => {
        const result = await auth.refresh(from.refreshToken as string);
        // A refusal ends the session; anything else (an unreachable server, a 500) leaves it alone to be retried,
        // because signing somebody out for a flaky network is the worst answer available.
        if (!result.ok) {
          if (result.status === 401 || result.status === 403) {
            await store(undefined);
          }

          return undefined;
        }

        const next = toSession(result.data);
        await store(next);

        return next;
      })();

      try {
        return await renewal.current;
      } finally {
        renewal.current = undefined;
      }
    },
    [auth, store]
  );

  const getAccessToken = useCallback(async (): Promise<string | undefined> => {
    const held = current.current;
    if (isUsable(held)) {
      return held?.accessToken;
    }

    if (held && isRenewable(held)) {
      return (await renew(held))?.accessToken;
    }

    if (held) {
      await store(undefined);
    }

    return undefined;
  }, [renew, store]);

  /**
   * What this window knows before it draws anything.
   *
   * The stored session is read once, and renewed here rather than on the first request that needs it: a window
   * that painted the spaces list and then bounced to sign-in a moment later is worse than one that waited.
   */
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const stored = parseSession(await desktop.readSession());
      current.current = stored;

      if (stored && !isUsable(stored) && isRenewable(stored)) {
        await renew(stored);
      } else if (stored && !isUsable(stored)) {
        await store(undefined);
      } else if (!cancelled) {
        setSession(stored);
      }

      if (!cancelled) {
        setReady(true);
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [desktop, renew, store]);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      const result = await auth.login(username, password);
      if (!result.ok) {
        return { ok: false, reason: result.reason, error: result.error };
      }

      await store(toSession(result.data));

      return { ok: true };
    },
    [auth, store]
  );

  const signup = useCallback((body: SignupBody) => auth.signup(body), [auth]);

  const logout = useCallback(async () => {
    const held = current.current;
    await store(undefined);
    // After the local session is gone, never before: a server that cannot be reached must not leave this window
    // signed in with a session the person has already asked to end.
    if (held) {
      await auth.logout(held.accessToken, held.refreshToken);
    }
  }, [auth, store]);

  const can = useCallback(
    (permission: string) => session?.user.permissions?.includes(permission) ?? false,
    [session?.user.permissions]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      isAuthenticated: session !== undefined,
      user: session?.user,
      getAccessToken,
      login,
      signup,
      logout,
      can,
      auth
    }),
    [ready, session, getAccessToken, login, signup, logout, can, auth]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
};

export default AuthProvider;
