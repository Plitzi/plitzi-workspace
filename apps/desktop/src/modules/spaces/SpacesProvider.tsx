import { useCallback, useEffect, useMemo, useState } from 'react';

import { byName, toSpace } from './space';
import SpacesContext from './SpacesContext';
import useAuth from '../auth/useAuth';

import type { Space, SpaceRow } from './space';
import type { SpacesContextValue, SpacesState } from './SpacesContext';
import type { ReactNode } from 'react';

export type SpacesProviderProps = {
  children?: ReactNode;
};

const EMPTY: SpacesState = { owned: [], guest: [], loading: true, error: undefined };

/** `'offline'` is its own answer because the window can show the list it already has beside it. */
const reasonOf = (failure: { status: number; error?: string }): string =>
  failure.status === 0 ? 'offline' : (failure.error ?? 'Could not load your spaces');

/**
 * No `api` prop any more, and no token either.
 *
 * Both are the auth context's now: a caller holding a raw client and a raw token is a caller deciding what a 401
 * means, and this one decided "show an error and keep the session" — so a session the server had stopped accepting
 * left the window loading forever with no way back to the sign-in screen.
 */
const SpacesProvider = ({ children }: SpacesProviderProps) => {
  const { isAuthenticated, ready, request } = useAuth();
  const [state, setState] = useState<SpacesState>(EMPTY);
  const [activeSpace, setActiveSpace] = useState<Space | undefined>(undefined);

  const load = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: undefined }));

    /**
     * ONE request for both lists.
     *
     * They used to be two, fired together — two reads of the same table, and two round trips over a network this
     * app has no control over, on every refresh and every reconnect. The endpoint takes several scopes now and
     * answers keyed by scope, so the sidebar's two sections cost one call.
     */
    const answer = await request<Partial<Record<'owned' | 'guest', SpaceRow[]>>>({
      path: '/spaces',
      query: { scope: 'owned,guest' }
    });

    // The session ended while this ran — `request` has already forgotten it, and the effect below will clear the
    // list when that lands. Reporting a failure as well would flash an error over the sign-in screen.
    if (answer.status === 401) {
      setState({ owned: [], guest: [], loading: false, error: undefined });

      return;
    }

    if (!answer.ok) {
      setState({ owned: [], guest: [], loading: false, error: reasonOf(answer) });

      return;
    }

    setState({
      // Defensive on each key rather than trusting the shape: a proxy or an older deployment answering the array
      // this endpoint used to give would otherwise throw inside `map` and take the whole sidebar with it.
      owned: (answer.data.owned ?? []).map(toSpace).sort(byName),
      guest: (answer.data.guest ?? []).map(toSpace).sort(byName),
      loading: false,
      error: undefined
    });
  }, [request]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!isAuthenticated) {
      setState({ owned: [], guest: [], loading: false, error: undefined });
      setActiveSpace(undefined);

      return;
    }

    void load();
  }, [ready, isAuthenticated, load]);

  const getSpace = useCallback(
    (permanentUrl: string): Space | undefined =>
      state.owned.find(space => space.permanentUrl === permanentUrl) ??
      state.guest.find(space => space.permanentUrl === permanentUrl),
    [state.owned, state.guest]
  );

  /**
   * The space's public credential, which is what the SDK renders from.
   *
   * Fetched per space and not held: it is a token with an expiry, and a desktop window can sit open for days —
   * so caching it here would eventually render a space with a credential the server has stopped accepting, which
   * looks like the space having disappeared.
   */
  const getWebKey = useCallback(
    async (spaceId: number): Promise<string | undefined> => {
      const result = await request<string>({ path: `/spaces/${spaceId}/token` });

      return result.ok ? result.data : undefined;
    },
    [request]
  );

  const value = useMemo<SpacesContextValue>(
    () => ({ ...state, activeSpace, setActiveSpace, getSpace, getWebKey, reload: load }),
    [state, activeSpace, getSpace, getWebKey, load]
  );

  return <SpacesContext value={value}>{children}</SpacesContext>;
};

export default SpacesProvider;
