import { createConnectorResolver } from '../connectors';
import { resolveRscData } from './resolveRscData';

import type { ConnectorLookups } from '../connectors/resolver';
import type { SSRAdapters } from '@plitzi/sdk-shared';

/**
 * `getRscData`, built from the connector lookups the server was already given.
 *
 * Every deployment that served server-driven elements wrote this same adapter: await the render payload, check the
 * schema opted into RSC, then hand `resolveRscData` a `createConnectorResolver` over the lookups — both of which are
 * this package's own exports, assembled by the consumer only because nothing assembled them here. That made the
 * lookups a thing you passed twice, once as config and once folded into an adapter, and put a copy of the enabled
 * check in every deployment.
 *
 * A deployment that resolves server elements some other way still supplies its own `getRscData`, and that one wins.
 */
export const connectorRscData = (lookups: ConnectorLookups): NonNullable<SSRAdapters['getRscData']> => {
  const resolveElement = createConnectorResolver(lookups);

  return async ({ req, spaceId, environment, user, ids, loadOfflineData }) => {
    // Joins the read the page render already started rather than asking for the document a second time.
    const offlineData = await loadOfflineData();
    if (!offlineData?.schema.rsc?.enabled) {
      return {};
    }

    return resolveRscData({ schema: offlineData.schema, req, spaceId, environment, user, ids, resolveElement });
  };
};
