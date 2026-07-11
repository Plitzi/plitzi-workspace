import { readResource, resourceErrorMessage } from '../resources';

import type { Space } from '../helpers';
import type { Env, ReadHit, ReadInput, ReadResponse } from '../types';

// Resolve many resource URIs in one call so an agent that already holds N refs (from search / a write response)
// does not spend N round-trips reading them. Each hit is either { stateVersion, data } or a teachable error,
// so one bad URI never fails the batch. Reuses readResource, so it stays in lockstep with single reads.
export const read = (input: ReadInput, space: Space, env: Env): ReadResponse => {
  const results = input.uris.map((uri): ReadHit => {
    const found = readResource(space, env, uri);
    if (found) {
      return { uri, stateVersion: found.stateVersion, data: found.data };
    }

    const parsed = JSON.parse(resourceErrorMessage(env, uri)) as { error: string; message: string; hint?: string };

    return { uri, error: parsed.error, message: parsed.message, hint: parsed.hint };
  });

  return { results };
};
