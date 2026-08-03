import { useCallback, use, useEffect, useMemo, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStoreSync } from '@plitzi/sdk-shared/store';

import ConnectorsContext from './ConnectorsContext';

import type { ConnectorsContextValue } from './ConnectorsContext';
import type { BuilderMutationsMap, BuilderQueriesMap, SpaceConnector } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

export type ConnectorsContextProviderProps = {
  children: ReactNode;
};

const byIdentifier = (connectors: SpaceConnector[]) =>
  connectors.reduce<Record<string, SpaceConnector>>((acum, connector) => {
    acum[connector.identifier] = connector;

    return acum;
  }, {});

/**
 * Loads the space's connector manifests and keeps them in the builder store.
 *
 * They live in the store rather than in this context alone because the provider element's settings panel — which
 * renders far from here, inside the element inspector — needs the connector list and each manifest's operators to
 * offer a picker and typed filters. The store is editor state and is never serialized into the published schema,
 * so putting endpoints there does not put them on a visitor's page.
 */
const ConnectorsContextProvider = ({ children }: ConnectorsContextProviderProps) => {
  const { query, mutate } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const [connectors, setConnectors] = useState<Record<string, SpaceConnector>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useBuilderStoreSync('connectors', connectors);

  useEffect(() => {
    let cancelled = false;
    const fetchConnectors = async () => {
      try {
        const response = await query('SpaceConnectors', { pageSize: 100 }, 'network-only');
        if (cancelled) {
          return;
        }

        setConnectors(byIdentifier(response.result?.SpaceConnectors.edges ?? []));
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchConnectors();

    return () => {
      cancelled = true;
    };
  }, [query]);

  const addConnector = useCallback(
    async (name: string, manifest: Record<string, unknown>) => {
      const response = await mutate('SpaceAddConnector', { name, manifest });
      const connector = response.result?.SpaceAddConnector;
      if (connector) {
        setConnectors(state => ({ ...state, [connector.identifier]: connector }));
      }

      return connector;
    },
    [mutate]
  );

  const updateConnector = useCallback(
    async (identifier: string, name: string, manifest: Record<string, unknown>) => {
      const response = await mutate('SpaceUpdateConnector', { identifier, name, manifest });
      const connector = response.result?.SpaceUpdateConnector;
      if (connector) {
        setConnectors(state => ({ ...state, [connector.identifier]: connector }));
      }

      return connector;
    },
    [mutate]
  );

  const removeConnector = useCallback(
    async (identifier: string) => {
      const response = await mutate('SpaceRemoveConnector', { identifier });
      if (!response.result?.SpaceRemoveConnector) {
        return false;
      }

      setConnectors(state => Object.fromEntries(Object.entries(state).filter(([key]) => key !== identifier)));

      return true;
    },
    [mutate]
  );

  const value = useMemo<ConnectorsContextValue>(
    () => ({ connectors, isLoading, error, addConnector, updateConnector, removeConnector }),
    [connectors, isLoading, error, addConnector, updateConnector, removeConnector]
  );

  return <ConnectorsContext value={value}>{children}</ConnectorsContext>;
};

export default ConnectorsContextProvider;
