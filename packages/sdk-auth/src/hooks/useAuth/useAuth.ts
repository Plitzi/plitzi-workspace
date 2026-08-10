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

/**
 * Read per event rather than once at import: a handful of reads per page load costs nothing, and reading it at
 * import time means the flag only ever works if it was already set before this module loaded — which is a footgun
 * for the one person who sets it and wonders why nothing happens.
 */

type User = Exclude<Exclude<AuthContextValue['user'], undefined>['details'], undefined>;

/**
 * `loading` is what a space's pages are held back by, so it is deliberately narrow: it means "this page cannot be
 * rendered yet", not "auth is doing something". A session restored from storage renders immediately and confirms
 * itself behind the render, which is the difference between a page that appears at once and one that waits on a
 * round trip to be told what it already knew.
 */
const useAuth = ({ server, isHydrating = false, provider = '', settings }: UseAuthProps) => {
  const bootstrapUser = server?.authenticated ? server.user?.details : undefined;
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

  /**
   * What the browser can see for itself, before `init()` has run.
   *
   * `init()` is an effect, so the first paint of a client-rendered page happens without it — and a visitor whose
   * session was in storage all along watched the signed-out page flash past on every reload. The evidence is
   * synchronous (a credential in storage, a hint in a cookie), so standing on it costs nothing and removes the
   * flash entirely.
   *
   * Not while hydrating: there the server already decided, its HTML is on screen, and reading storage instead could
   * only disagree with it — which is a hydration mismatch rather than a fix.
   */
  const peeked = useMemo(
    () => (isHydrating || bootstrapUser ? undefined : manager.peek()),
    [manager, isHydrating, bootstrapUser]
  );

  /**
   * Has anything answered who this visitor is yet?
   *
   * This is what holds a page back, and it must be answered BEFORE the first render or not at all: a space whose
   * pages differ only by `accessLevel` — one for a guest, one for a signed-in visitor — picks between them from
   * this. Render before it is settled and the wrong page is not merely shown, it is MOUNTED: `RawMode` keys the
   * page on its id, so swapping it unmounts one page and mounts the other, running both pages' `onLoad`.
   *
   * Four things can answer, and three of them cost nothing:
   * - the server, when it rendered this page for somebody (`bootstrapUser`);
   * - the HTML already on screen, when this is a hydration — the server decided, whatever it decided;
   * - this browser itself, when the peek finds a live session or no evidence at all;
   * - failing all of those, `init()` — and only then is there anything to wait for.
   *
   * So the wait happens exactly when the answer needs a request, and never otherwise.
   */
  const decided =
    (state !== 'init' && state !== 'initLoading') ||
    !!bootstrapUser ||
    isHydrating ||
    peeked?.state === 'authenticated' ||
    peeked?.state === 'guest';

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
      /**
       * Who this browser can be seen to hold a session for, read synchronously before `init()` runs.
       *
       * Published for the same reason `bootstrapUser` is: the provider fills in from an effect, so on a
       * client-rendered page the auth data source was EMPTY for the first commit — `{{user.*}}` rendered blank and
       * filled in a moment later, on every reload of every signed-in visitor.
       */
      peekedUser: peeked?.user,
      peekedToken: peeked?.token?.accessToken,
      loading: state === 'initLoading' || !decided,
      /**
       * Before the browser has decided, the server's answer stands. `state` only becomes `authenticated` from
       * `init()`, which runs in an effect — and effects do not run during a server render, so this read was false on
       * the server for a visitor the server had just resolved. Page-level access rules are evaluated against it, so
       * an `accessLevel: 'authenticated'` page never won on the server, and the browser then picked a different page
       * than the HTML it was hydrating.
       */
      authenticated:
        state === 'authenticated' || (state === 'init' && (!!bootstrapUser || peeked?.state === 'authenticated'))
    }),
    [manager, state, bootstrapUser, bootstrapToken, decided, peeked]
  );

  return hookValue;
};

export default useAuth;
