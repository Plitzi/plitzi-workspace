import { treeOf } from '@plitzi/sdk-schema/helpers/components';

import {
  afterPrefix,
  componentSummariesToAI,
  componentView,
  componentsUri,
  dataSourcesUri,
  findComponentByRef,
  elementUri,
  findElementByRef,
  findRootByRef,
  folderUri,
  foldersUri,
  interactionsUri,
  layoutsUri,
  pageUri,
  pagesUri,
  flagsUri,
  schemaVarsUri,
  settingsUri
} from '../helpers';
import { envelope } from './envelope';
import { buildDataSourceCatalog, buildInteractionCatalog } from '../catalogs';
import {
  elementView,
  folderRefToAI,
  foldersToAI,
  layoutSummariesToAI,
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

  if (uri === layoutsUri(env)) {
    return envelope(layoutSummariesToAI(space.schema));
  }

  if (uri === componentsUri(env)) {
    return envelope(componentSummariesToAI(space.schema));
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
    // `findRootByRef`, so `pages/{ref}` reads a LAYOUT shell as readily as a page: it is the same skeleton of the
    // same kind of tree, and an agent that just read `layout: "main"` off a page has one obvious thing to do next.
    // A component is a root too, read through the view an op addressed to it edits.
    const styles = pageItem.endsWith('/styles');
    const ref = styles ? pageItem.slice(0, -'/styles'.length) : pageItem;
    const component = findComponentByRef(space.schema, ref);
    const target = component ? componentView(space, component) : space;
    const page = findRootByRef(target.schema, component ? component.rootId : ref);
    if (!page) {
      return null;
    }

    return envelope(
      styles ? pageStylesToAI(target.schema, target.style, page) : pageSkeletonToAI(target.schema, page, target.style)
    );
  }

  const elementRef = afterPrefix(uri, elementUri(env, ''));
  if (elementRef !== undefined) {
    // Ids are one namespace, so an element is found wherever it is — inside a component, through its view.
    const componentId = treeOf(space.schema, elementRef)?.componentId;
    const component = componentId ? findComponentByRef(space.schema, componentId) : undefined;
    const target = component ? componentView(space, component) : space;
    const el = findElementByRef(target.schema, elementRef);
    if (!el) {
      return null;
    }

    const view = elementView(target.schema, el, target.style);

    return { stateVersion: view.version, data: view.detail };
  }

  if (uri === schemaVarsUri(env)) {
    return envelope(schemaVariablesToAI(space.schema));
  }

  if (uri === flagsUri(env)) {
    return envelope(space.schema.flags ?? {});
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
