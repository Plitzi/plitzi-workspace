import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthManager } from '../../AuthManager';

import type { AuthEvent } from '../../AuthProvider';
import type { AuthProviderSettings } from '../../types';
import type { AuthContextValue, AuthState, Server } from '@plitzi/sdk-shared';

export type UseAuthProps = {
  server?: Server;
  isHydrating?: boolean;
  provider?: string;
  /** Held stable by the caller: a new object here builds a new provider and re-runs the whole boot decision. */
  settings: AuthProviderSettings;
};

type User = Exclude<Exclude<AuthContextValue['user'], undefined>['details'], undefined>;

/**
 * `loading` is what a space's pages are held back by, so it is deliberately narrow: it means "this page cannot be
 * rendered yet", not "auth is doing something". A session restored from storage renders immediately and confirms
 * itself behind the render, which is the difference between a page that appears at once and one that waits on a
 * round trip to be told what it already knew.
 */
const useAuth = ({ server, isHydrating = false, provider = '', settings }: UseAuthProps) => {
  const bootstrapUser = server?.authenticated ? server.user?.details : undefined;
  /**
   * A server-rendered page arrives already knowing who the visitor is — **including when the answer is nobody**.
   * That distinction is the whole of this flag: `bootstrapUser` is absent for a guest, so keying "we know" off it
   * made the server hold the page back while the browser, hydrating, rendered it. The two sides then disagreed
   * about the entire tree, which React reports as a hydration mismatch on every signed-out page.
   */
  const serverAnswered = server !== undefined;
  // `Server` allows a promise here (a token resolved later); only a settled string is a credential this can hand on.
  const bootstrapToken = typeof server?.user?.accessToken === 'string' ? server.user.accessToken : undefined;
  const [state, setState] = useState<AuthState>('init');

  const handleEvent = useCallback((event: AuthEvent) => {
    if (event.type === 'state') {
      setState(event.state);
    }
  }, []);

  const manager = useMemo(
    () => new AuthManager<User>(provider, handleEvent, settings),
    [provider, handleEvent, settings]
  );

  useEffect(() => {
    void manager.init({
      user: bootstrapUser,
      accessToken: bootstrapToken,
      expiresAt: server?.user?.expiresAt,
      skipAuth: server?.skipAuth
    });

    return () => manager.dispose();
  }, [manager, bootstrapUser, bootstrapToken, server?.user?.expiresAt, server?.skipAuth]);

  // A server-rendered page arrives with its answer already in hand, and the browser has nothing to wait for.
  const hookValue = useMemo(
    () => ({
      manager,
      state,
      /** Who the server rendered this page for, so a consumer can stand on it until the browser has decided. */
      bootstrapUser,
      bootstrapToken,
      loading: state === 'initLoading' || (state === 'init' && !bootstrapUser && !serverAnswered && !isHydrating),
      /**
       * Before the browser has decided, the server's answer stands. `state` only becomes `authenticated` from
       * `init()`, which runs in an effect — and effects do not run during a server render, so this read was false on
       * the server for a visitor the server had just resolved. Page-level access rules are evaluated against it, so
       * an `accessLevel: 'authenticated'` page never won on the server, and the browser then picked a different page
       * than the HTML it was hydrating.
       */
      authenticated: state === 'authenticated' || (state === 'init' && !!bootstrapUser)
    }),
    [manager, state, bootstrapUser, bootstrapToken, serverAnswered, isHydrating]
  );

  return hookValue;
};

export default useAuth;
