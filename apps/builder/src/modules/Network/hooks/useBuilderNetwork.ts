import { use } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderMutationsMap, BuilderQueriesMap } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { SpaceEventMap } from '@plitzi/sdk-shared/network/spaceEvents';

export type BuilderNetwork = BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap, SpaceEventMap>;

/**
 * The builder's network: its queries, mutations and the space's events, typed by what the builder asks for.
 *
 * The context is shared with the SDK, which fills it with less, so it is typed for both. Inside the builder its value
 * is always the one `NetworkContextProvider` writes — that is what makes this the one place it is read as that.
 */
const useBuilderNetwork = (): BuilderNetwork => use(NetworkContext) as BuilderNetwork;

export default useBuilderNetwork;
