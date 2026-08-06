import type { ConnectorRecord, PageInfo } from '@plitzi/sdk-shared';

/**
 * The manifest vocabulary lives in `@plitzi/sdk-shared` because the builder authors the document the engine
 * executes. Only the result shapes below are server-side: nothing outside this process ever sees them.
 */
export type {
  ConnectorAuth,
  ConnectorCredential,
  ConnectorEndpoints,
  ConnectorFilter,
  ConnectorListEndpoint,
  ConnectorManifest,
  ConnectorManifestDraft,
  ConnectorPagination,
  ConnectorQuery,
  ConnectorRecord,
  ConnectorWrite,
  ConnectorWriteAction,
  ConnectorWriteOperation
} from '@plitzi/sdk-shared';

/**
 * `PageInfo` is the cursor-shaped connection contract shared with GraphQL. A pager cannot be rendered from cursors
 * alone, so a connector result also carries the ordinal window it just read.
 */
export type ConnectorPageInfo = PageInfo & {
  page: number;
  /** Total pages when the provider reports a total; `0` when it does not and paging relies on page size. */
  pageCount: number;
};

export type ConnectorResult = {
  records: ConnectorRecord[];
  pageInfo: ConnectorPageInfo;
};
