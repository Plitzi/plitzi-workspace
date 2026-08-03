import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';

import { fetchConnectorRecords } from './engine';
import { collectBoundPaths, projectSlice } from './projection';

import type { ConnectorCredential, ConnectorFilter, ConnectorManifest } from './types';
import type { RscElementResolver } from '../rsc/resolveRscData';

export type ConnectorLookups = {
  /** Reads a manifest by id. Server-side state: manifests name endpoints and must never reach the browser. */
  getConnector: (spaceId: number, connectorId: string) => Promise<ConnectorManifest | undefined>;
  /** Resolves the secret referenced by `manifest.credential`. */
  getCredential?: (spaceId: number, identifier: string) => Promise<ConnectorCredential | undefined>;
  fetchImpl?: typeof fetch;
};

type ProviderAttributes = {
  connector?: string;
  resource?: string;
  limit?: string | number;
  singleRecord?: boolean;
  filters?: ConnectorFilter[];
};

const toLimit = (limit: string | number | undefined, singleRecord: boolean) => {
  if (singleRecord) {
    return 1;
  }

  const parsed = typeof limit === 'string' ? parseInt(limit, 10) : limit;

  return parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
};

/**
 * Bridges the connector engine into the RSC pipeline: reads the provider element's own configuration, resolves its
 * manifest and credential server-side, and returns the slice the element will publish as a binding source.
 *
 * An element without a connector resolves to nothing rather than failing — an unconfigured provider on a page is a
 * draft, not an error.
 */
export const createConnectorResolver =
  ({ getConnector, getCredential, fetchImpl }: ConnectorLookups): RscElementResolver =>
  async ({ element, flat, routeParams, queryParams, spaceId }) => {
    const {
      connector: connectorId,
      resource,
      limit,
      singleRecord = false,
      filters
    } = element.attributes as ProviderAttributes;
    if (!connectorId) {
      return undefined;
    }

    const manifest = await getConnector(spaceId, connectorId);
    if (!manifest) {
      throw new Error(`Connector "${connectorId}" is not configured for space ${spaceId}`);
    }

    const credential =
      manifest.credential && getCredential ? await getCredential(spaceId, manifest.credential) : undefined;
    const { records, pageInfo } = await fetchConnectorRecords({
      manifest,
      credential,
      query: {
        resource,
        limit: toLimit(limit, singleRecord),
        filters,
        routeParams,
        queryParams
      },
      fetchImpl
    });

    const slice = singleRecord ? { record: records[0], pageInfo } : { records, pageInfo };
    if (manifest.projection === 'full') {
      return slice;
    }

    return projectSlice(slice, collectBoundPaths(flat, element.id, getSourceName(element.definition.type, element)));
  };
