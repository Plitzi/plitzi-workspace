import { paginationDocs } from './manifestDoc';

import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

const EMPTY = '—';

/**
 * One short line per section, shown on its collapsed header.
 *
 * Collapsing is only an improvement if a closed section still answers "what is in there". Without these the panel
 * trades a wall of fields for a wall of chevrons, and the author has to open all seven to check their own work.
 */
export const summarize = {
  auth: (manifest: ConnectorManifestDraft) => {
    if (!manifest.auth?.name) {
      return 'None';
    }

    return `${manifest.auth.in === 'query' ? 'Query' : 'Header'} · ${manifest.auth.name}`;
  },

  list: (manifest: ConnectorManifestDraft) => manifest.endpoints.list.path || EMPTY,

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

  media: (manifest: ConnectorManifestDraft) => manifest.media?.baseUrl || EMPTY,

  writes: (manifest: ConnectorManifestDraft) => {
    const actions = Object.keys(manifest.endpoints.write ?? {});

    return actions.length ? actions.join(', ') : 'Read-only';
  }
};

/** True when a section holds something the collapsed header cannot show, so its header can hint at it. */
export const hasResponseMapping = (manifest: ConnectorManifestDraft): boolean => {
  const { itemsPath, totalPath, idPath, valuesPath } = manifest.endpoints.list;

  return Boolean(itemsPath ?? totalPath ?? idPath ?? valuesPath);
};
