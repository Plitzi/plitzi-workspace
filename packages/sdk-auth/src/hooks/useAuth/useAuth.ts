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
      accessToken: typeof server?.user?.accessToken === 'string' ? server.user.accessToken : undefined,
      expiresAt: server?.user?.expiresAt,
      skipAuth: server?.skipAuth
    });

    return () => manager.dispose();
  }, [manager, bootstrapUser, server?.user?.accessToken, server?.user?.expiresAt, server?.skipAuth]);

  // A server-rendered page arrives with its answer already in hand, and the browser has nothing to wait for.
  const hookValue = useMemo(
    () => ({
      manager,
      state,
      loading: state === 'initLoading' || (state === 'init' && !bootstrapUser && !serverAnswered && !isHydrating),
      authenticated: state === 'authenticated'
    }),
    [manager, state, bootstrapUser, serverAnswered, isHydrating]
  );

  return hookValue;
};

export default useAuth;
