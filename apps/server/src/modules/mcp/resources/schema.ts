import { findElementByRef, findPageByRef } from '../helpers';
import { envelope } from './envelope';
import { buildDataSourceCatalog, buildInteractionCatalog } from '../tools/operations/schema/observed';
import {
  elementDetailToAI,
  folderRefToAI,
  foldersToAI,
  pageSkeletonToAI,
  pageStylesToAI,
  pageSummariesToAI,
  schemaVariablesToAI
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
  if (uri === `plitzi://schema/${env}/pages`) {
    return envelope(pageSummariesToAI(space.schema));
  }

  if (uri === `plitzi://folders/${env}`) {
    return envelope(foldersToAI(space.schema));
  }

  if (uri.startsWith(`plitzi://folders/${env}/`)) {
    const ref = uri.slice(`plitzi://folders/${env}/`.length);
    const folder = folderRefToAI(space.schema, ref);

    return folder ? envelope(folder) : null;
  }

  if (uri.startsWith(`plitzi://schema/${env}/pages/`) && uri.endsWith('/styles')) {
    const ref = uri.slice(`plitzi://schema/${env}/pages/`.length, -'/styles'.length);
    const page = findPageByRef(space.schema, ref);

    return page ? envelope(pageStylesToAI(space.schema, space.style, page)) : null;
  }

  if (uri.startsWith(`plitzi://schema/${env}/pages/`)) {
    const ref = uri.slice(`plitzi://schema/${env}/pages/`.length);
    const page = findPageByRef(space.schema, ref);

    return page ? envelope(pageSkeletonToAI(space.schema, page)) : null;
  }

  if (uri.startsWith(`plitzi://schema/${env}/elements/`)) {
    const ref = uri.slice(`plitzi://schema/${env}/elements/`.length);
    const el = findElementByRef(space.schema, ref);

    return el ? envelope(elementDetailToAI(space.schema, el, space.style)) : null;
  }

  if (uri === `plitzi://schema-variables/${env}`) {
    return envelope(schemaVariablesToAI(space.schema));
  }

  if (uri === `plitzi://interactions/${env}`) {
    return envelope(buildInteractionCatalog(space.schema));
  }

  if (uri === `plitzi://data-sources/${env}`) {
    return envelope(buildDataSourceCatalog(space.schema));
  }

  return undefined;
};
