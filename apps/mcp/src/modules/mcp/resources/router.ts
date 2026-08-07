import { canonicalUri } from './canonical';
import { readConnectorResource } from './connectors';
import { readCoreResource } from './core';
import { readPrimerResource } from './primer';
import { readRenderResource } from './renderGuide';
import { readSchemaResource } from './schema';
import { readStyleResource } from './style';
import { emptySpace, typesUri } from '../helpers';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

// Ordered resolvers, each owning one URI family. A resolver returns undefined to pass ("not mine"), or an
// envelope / null once it recognizes the shape (null = valid shape, ref did not resolve). Core and render are
// space-independent; primer must precede schema/style since it aggregates their summaries.
const resolvers = [
  (space: Space, _env: Env, uri: string) => readCoreResource(space, uri),
  (_space: Space, _env: Env, uri: string) => readRenderResource(uri),
  readPrimerResource,
  readSchemaResource,
  readStyleResource,
  readConnectorResource
];

/** Resolve a resource URI to its versioned envelope, or null if unknown / not found. */
export const readResource = (space: Space, env: Env, rawUri: string): ResourceEnvelope<unknown> | null => {
  const uri = canonicalUri(env, rawUri);
  for (const resolve of resolvers) {
    const result = resolve(space, env, uri);
    if (result !== undefined) {
      return result;
    }
  }

  return null;
};

/** What a connection carrying NO space (a guest / widgets-only grant) can still read: the space-independent
 *  singletons and the render docs. Undefined for everything else, so the caller says the connection has no space
 *  instead of answering out of an empty one — an empty page list would read as "this space has no pages". */
export const readPublicResource = (env: Env, rawUri: string): ResourceEnvelope<unknown> | undefined => {
  const uri = canonicalUri(env, rawUri);
  // plitzi://types is projected from the space's own elements, so it is only nominally space-independent — the
  // static built-in catalog such a connection wants is plitzi://render/types.
  if (uri === typesUri) {
    return undefined;
  }

  return readRenderResource(uri) ?? readCoreResource(emptySpace(), uri);
};

/** Current version of a resource, for optimistic-concurrency checks. Null when the URI is unknown. */
export const resourceVersion = (space: Space, env: Env, uri: string): string | null =>
  readResource(space, env, uri)?.stateVersion ?? null;
