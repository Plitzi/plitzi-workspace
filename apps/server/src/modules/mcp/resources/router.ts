import { canonicalUri } from './canonical';
import { readCoreResource } from './core';
import { readPrimerResource } from './primer';
import { readSchemaResource } from './schema';
import { readStyleResource } from './style';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

// Ordered resolvers, each owning one URI family. A resolver returns undefined to pass ("not mine"), or an
// envelope / null once it recognizes the shape (null = valid shape, ref did not resolve). Core is space-
// independent; primer must precede schema/style since it aggregates their summaries.
const resolvers = [
  (space: Space, _env: Env, uri: string) => readCoreResource(space, uri),
  readPrimerResource,
  readSchemaResource,
  readStyleResource
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

/** Current version of a resource, for optimistic-concurrency checks. Null when the URI is unknown. */
export const resourceVersion = (space: Space, env: Env, uri: string): string | null =>
  readResource(space, env, uri)?.stateVersion ?? null;
