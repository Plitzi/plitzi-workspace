import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';

import { fetchConnectorRecords } from './engine';
import { collectBoundPaths, projectSlice } from './projection';

import type { ConnectorCredential, ConnectorFilter, ConnectorManifest } from './types';
import type { RscElementResolver } from '../rsc/resolveRscData';
import type { SpaceRevision } from '@plitzi/sdk-shared';

export type ConnectorLookups = {
  /**
   * Reads a manifest by id, as of a published revision. Server-side state: manifests name endpoints and must never
   * reach the browser.
   *
   * `at` absent means the live document, the one the builder edits. A page passes the revision it was published
   * at, so it reads through the manifest it shipped with rather than whatever it says after somebody points that
   * connector at a different API.
   */
  getConnector: (spaceId: number, connectorId: string, at?: SpaceRevision) => Promise<ConnectorManifest | undefined>;
  /** Resolves the secret referenced by `manifest.credential`. */
  getCredential?: (spaceId: number, identifier: string) => Promise<ConnectorCredential | undefined>;
  fetchImpl?: typeof fetch;
};

export type ProviderPagination = 'none' | 'url' | 'append';

type ProviderAttributes = {
  connector?: string;
  /** Which of the connector's read endpoints to execute. Defaults to `list`. */
  endpoint?: string;
  resource?: string;
  limit?: string | number;
  singleRecord?: boolean;
  filters?: ConnectorFilter[];
  pagination?: ProviderPagination;
  /** Query-string key carrying the requested page. Distinct per element so two lists can page independently. */
  pageParam?: string;
};

const DEFAULT_PAGE_PARAM = 'page';

const toLimit = (limit: string | number | undefined, singleRecord: boolean) => {
  if (singleRecord) {
    return 1;
  }

  const parsed = typeof limit === 'string' ? parseInt(limit, 10) : limit;

  return parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
};

/**
 * Reads the requested page out of the request's query string.
 *
 * Both pagination modes arrive here: URL paging puts the parameter in the visitor's address bar, and append mode
 * puts the same parameter on its `/_rsc` refresh. One code path, so a "load more" window and a shared link of the
 * same page resolve to the same records.
 */
const toPage = (queryParams: Record<string, string>, attributes: ProviderAttributes) => {
  if (attributes.pagination === 'none' || attributes.singleRecord) {
    return 1;
  }

  const raw = queryParams[attributes.pageParam ?? DEFAULT_PAGE_PARAM];
  const parsed = raw ? parseInt(raw, 10) : NaN;

  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
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
  async ({ element, flat, routeParams, queryParams, spaceId, environment, req }) => {
    // Environment AND revision from the same record: read one from the deployment and the other from the resolve
    // context and the pair can name a snapshot nobody published.
    const deployment = req.ctx.spaceDeployment;
    const at = { environment: deployment?.environment ?? environment, revision: deployment?.revision ?? 0 };
    const attributes = element.attributes as ProviderAttributes;
    const { connector: connectorId, endpoint, resource, limit, singleRecord = false, filters } = attributes;
    if (!connectorId) {
      return undefined;
    }

    const manifest = await getConnector(spaceId, connectorId, at);
    if (!manifest) {
      throw new Error(`Connector "${connectorId}" is not configured for space ${spaceId}`);
    }

    const credential =
      manifest.credential && getCredential ? await getCredential(spaceId, manifest.credential) : undefined;
    const pageSize = toLimit(limit, singleRecord);
    const page = toPage(queryParams, attributes);
    const pageParam = attributes.pageParam ?? DEFAULT_PAGE_PARAM;
    const { records, pageInfo } = await fetchConnectorRecords({
      manifest,
      endpoint,
      credential,
      query: {
        resource,
        limit: pageSize,
        offset: pageSize === undefined ? undefined : (page - 1) * pageSize,
        page,
        // A cursor provider cannot address a window by ordinal, so the client echoes back the token it was handed
        // under the element's own parameter rather than reusing the page number.
        cursor: queryParams[`${pageParam}Cursor`],
        filters,
        routeParams,
        queryParams
      },
      fetchImpl
    });

    // The state flags travel with the data so an empty or failed provider is authorable with the elements that
    // already exist — a container binding its visibility to `isEmpty` needs no new slot mechanism.
    const slice = {
      ...(singleRecord ? { record: records[0] } : { records }),
      pageInfo,
      isEmpty: records.length === 0,
      hasError: false,
      errorMessage: ''
    };
    if (manifest.projection === 'full') {
      return slice;
    }

    return projectSlice(slice, collectBoundPaths(flat, element.id, getSourceName(element.definition.type, element.id)));
  };
