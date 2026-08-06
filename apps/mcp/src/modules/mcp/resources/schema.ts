import {
  afterPrefix,
  dataSourcesUri,
  elementUri,
  findElementByRef,
  findPageByRef,
  folderUri,
  foldersUri,
  interactionsUri,
  pageUri,
  pagesUri,
  schemaVarsUri,
  settingsUri
} from '../helpers';
import { envelope } from './envelope';
import { buildDataSourceCatalog, buildInteractionCatalog } from '../catalogs';
import {
  elementView,
  folderRefToAI,
  foldersToAI,
  pageSkeletonToAI,
  pageStylesToAI,
  pageSummariesToAI,
  schemaVariablesToAI,
  settingsToAI
} from '../tools/operations/schema/translator';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

/** Element-schema reads: page listings/skeletons/styles, folders, single elements and schema variables. Returns
 *  undefined when the URI belongs to another domain, null when the shape is ours but the ref does not resolve. */
export const readSchemaResource = (
  space: Space,
  env: Env,
  uri: string
): ResourceEnvelope<unknown> | null | undefined => {
  if (uri === pagesUri(env)) {
    return envelope(pageSummariesToAI(space.schema));
  }

  if (uri === foldersUri(env)) {
    return envelope(foldersToAI(space.schema));
  }

  const folderRef = afterPrefix(uri, folderUri(env, ''));
  if (folderRef !== undefined) {
    const folder = folderRefToAI(space.schema, folderRef);

    return folder ? envelope(folder) : null;
  }

  const pageItem = afterPrefix(uri, pageUri(env, ''));
  if (pageItem !== undefined) {
    if (pageItem.endsWith('/styles')) {
      const ref = pageItem.slice(0, -'/styles'.length);
      const page = findPageByRef(space.schema, ref);

      return page ? envelope(pageStylesToAI(space.schema, space.style, page)) : null;
    }

    const page = findPageByRef(space.schema, pageItem);

    return page ? envelope(pageSkeletonToAI(space.schema, page, space.style)) : null;
  }

  const elementRef = afterPrefix(uri, elementUri(env, ''));
  if (elementRef !== undefined) {
    const el = findElementByRef(space.schema, elementRef);
    if (!el) {
      return null;
    }

    const view = elementView(space.schema, el, space.style);

    return { stateVersion: view.version, data: view.detail };
  }

  if (uri === schemaVarsUri(env)) {
    return envelope(schemaVariablesToAI(space.schema));
  }

  if (uri === settingsUri(env)) {
    return envelope(settingsToAI(space.schema));
  }

  if (uri === interactionsUri(env)) {
    return envelope(buildInteractionCatalog(space.schema));
  }

  if (uri === dataSourcesUri(env)) {
    return envelope(buildDataSourceCatalog(space.schema));
  }

  return undefined;
};
