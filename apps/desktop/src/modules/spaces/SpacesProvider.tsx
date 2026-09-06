import { useCallback, useEffect, useMemo, useState } from 'react';

import { byName, toSpace } from './space';
import SpacesContext from './SpacesContext';
import useAuth from '../auth/useAuth';

import type { Space, SpaceRow } from './space';
import type { SpacesContextValue, SpacesState } from './SpacesContext';
import type { ApiClient } from '@pmodules/network';
import type { ReactNode } from 'react';

export type SpacesProviderProps = {
  children?: ReactNode;
  api: ApiClient;
};

const EMPTY: SpacesState = { owned: [], guest: [], loading: true, error: undefined };

/** `'offline'` is its own answer because the window can show the list it already has beside it. */
const reasonOf = (failure: { status: number; error?: string }): string =>
  failure.status === 0 ? 'offline' : (failure.error ?? 'Could not load your spaces');

const SpacesProvider = ({ children, api }: SpacesProviderProps) => {
  const { isAuthenticated, ready, getAccessToken } = useAuth();
  const [state, setState] = useState<SpacesState>(EMPTY);
  const [activeSpace, setActiveSpace] = useState<Space | undefined>(undefined);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setState({ owned: [], guest: [], loading: false, error: undefined });

      return;
    }

    setState(previous => ({ ...previous, loading: true, error: undefined }));

    // Both scopes at once: they are two reads of the same table and the sidebar shows them together, so serialising
    // them would only make the list appear in two steps.
    const [owned, guest] = await Promise.all([
      api.request<SpaceRow[]>({ path: '/spaces', query: { scope: 'owned' }, token }),
      api.request<SpaceRow[]>({ path: '/spaces', query: { scope: 'guest' }, token })
    ]);

    if (!owned.ok) {
      setState({ owned: [], guest: [], loading: false, error: reasonOf(owned) });

      return;
    }

    if (!guest.ok) {
      setState({ owned: [], guest: [], loading: false, error: reasonOf(guest) });

      return;
    }

    setState({
      owned: owned.data.map(toSpace).sort(byName),
      guest: guest.data.map(toSpace).sort(byName),
      loading: false,
      error: undefined
    });
  }, [api, getAccessToken]);

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
      const token = await getAccessToken();
      if (!token) {
        return undefined;
      }

      const result = await api.request<string>({ path: `/spaces/${spaceId}/token`, token });

      return result.ok ? result.data : undefined;
    },
    [api, getAccessToken]
  );

  const value = useMemo<SpacesContextValue>(
    () => ({ ...state, activeSpace, setActiveSpace, getSpace, getWebKey, reload: load }),
    [state, activeSpace, getSpace, getWebKey, load]
  );

  return <SpacesContext value={value}>{children}</SpacesContext>;
};

export default SpacesProvider;
