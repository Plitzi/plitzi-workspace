import { paginationDocs } from './manifestDoc';

import type { ConnectorManifestDraft, ConnectorReadEndpoint, ConnectorWriteEndpoint } from '@plitzi/sdk-shared';

const EMPTY = '—';

/**
 * One short line per section, shown on its collapsed header.
 *
 * Collapsing is only an improvement if a closed section still answers "what is in there". Without these the panel
 * trades a wall of fields for a wall of chevrons, and the author has to open all of them to check their own work.
 */
export const summarize = {
  auth: (manifest: ConnectorManifestDraft) => {
    if (!manifest.auth?.name) {
      return 'None';
    }

    return `${manifest.auth.in === 'query' ? 'Query' : 'Header'} · ${manifest.auth.name}`;
  },

  endpoints: (manifest: ConnectorManifestDraft) => {
    const reads = Object.keys(manifest.endpoints.read).length;
    const writes = Object.keys(manifest.endpoints.write ?? {}).length;

    return `${reads} read · ${writes} write`;
  },

  pagination: (manifest: ConnectorManifestDraft) => {
    const doc = paginationDocs.find(item => item.value === (manifest.pagination ?? 'offset'));

    return doc?.label ?? EMPTY;
  },

  filters: (manifest: ConnectorManifestDraft) => {
    const names = Object.keys(manifest.operators ?? {});
    if (!names.length) {
      return 'None';
    }

    return names.length <= 3 ? names.join(', ') : `${names.length} operators`;
  },

  media: (manifest: ConnectorManifestDraft) => manifest.media?.baseUrl || EMPTY
};

/** `GET /api/posts` — the request itself, which is what identifies an endpoint at a glance. */
export const summarizeEndpoint = (endpoint: ConnectorReadEndpoint | ConnectorWriteEndpoint): string =>
  `${endpoint.method ?? 'GET'} ${endpoint.path || EMPTY}`;

/** True when a read endpoint maps the response by hand, so a collapsed header can say it was customized. */
export const hasResponseMapping = (endpoint: ConnectorReadEndpoint): boolean =>
  Boolean(endpoint.itemsPath ?? endpoint.totalPath ?? endpoint.idPath ?? endpoint.valuesPath);
