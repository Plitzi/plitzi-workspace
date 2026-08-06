import { useCallback, use, useMemo } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStoreSync } from '@plitzi/sdk-shared/store';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import ConnectorsContext from './ConnectorsContext';

import type { ConnectorsContextValue } from './ConnectorsContext';
import type {
  BuilderMutationsMap,
  BuilderQueriesMap,
  ConnectorManifestDraft,
  SpaceConnector
} from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { ReactNode } from 'react';

export type ConnectorsContextProviderProps = {
  children: ReactNode;
};

const emptyConnectors: SpaceConnector[] = [];

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
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const {
    data = emptyConnectors,
    error,
    isLoading,
    mutate
  } = useGraphQL('SpaceConnectors', data => data?.SpaceConnectors.edges, { pageSize: 100 });
  // A connector is worthless without a server to resolve it, and the space only has one when something it deploys to
  // can run server code. Read it off the deployments rather than a flag, so the panel cannot claim otherwise.
  const { data: deployments } = useGraphQL('SpaceDeployments', data => data?.SpaceDeployments.edges);

  const connectors = useMemo(() => byIdentifier(data), [data]);
  // Unknown counts as "has one": the deployments arrive a moment after the panel does, and a space that is correctly
  // set up should not flash a warning telling its owner it is broken. A late warning beats a wrong one.
  const hasServerRendering = useMemo(
    () => deployments === undefined || deployments.some(deployment => deployment.credential?.provider === 'ssr'),
    [deployments]
  );

  useBuilderStoreSync('connectors', connectors);
  useBuilderStoreSync('hasServerRendering', hasServerRendering);

  const addConnector = useCallback(
    async (name: string, manifest: ConnectorManifestDraft) => {
      const response = await mutateNetwork('SpaceAddConnector', { name, manifest });
      // Revalidating rather than merging the payload in: the list is a query, and one owner for it means a create
      // that succeeded server-side can never leave the panel showing something else.
      await mutate();

      return response.result;
    },
    [mutate, mutateNetwork]
  );

  const updateConnector = useCallback(
    async (identifier: string, name: string, manifest: ConnectorManifestDraft) => {
      const response = await mutateNetwork('SpaceUpdateConnector', { identifier, name, manifest });
      await mutate();

      return response.result;
    },
    [mutate, mutateNetwork]
  );

  const removeConnector = useCallback(
    async (identifier: string) => {
      const response = await mutateNetwork('SpaceRemoveConnector', { identifier });
      await mutate();

      return Boolean(response.result);
    },
    [mutate, mutateNetwork]
  );

  const value = useMemo<ConnectorsContextValue>(
    () => ({
      connectors,
      isLoading,
      error: error?.message ?? '',
      hasServerRendering,
      addConnector,
      updateConnector,
      removeConnector
    }),
    [connectors, isLoading, error, hasServerRendering, addConnector, updateConnector, removeConnector]
  );

  return <ConnectorsContext value={value}>{children}</ConnectorsContext>;
};

export default ConnectorsContextProvider;
