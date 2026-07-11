import { readResource, resourceVersion } from '../resources';

import type { Space } from '../helpers';
import type { AIElementDetail, ChangedResource, Conflict, Env, WriteElement } from '../types';

// Helpers that assemble a plitzi_apply result: optimistic-concurrency conflict detection, the changed-resource
// versions, and the full detail of every element the batch created/updated. The shapes they return live in
// types/toolTypes.ts.

export const detectConflicts = (space: Space, env: Env, expected: Record<string, string> | undefined): Conflict[] => {
  if (!expected) {
    return [];
  }

  const conflicts: Conflict[] = [];
  for (const [uri, version] of Object.entries(expected)) {
    const current = resourceVersion(space, env, uri);
    if (current !== null && current !== version) {
      conflicts.push({ resourceUri: uri, expectedVersion: version, currentVersion: current });
    }
  }

  return conflicts;
};

export const changedResources = (space: Space, env: Env, uris: string[]): ChangedResource[] =>
  uris.map(uri => ({ uri, stateVersion: resourceVersion(space, env, uri) ?? '' }));

/** Full detail of each created/updated element (by ref), skipping any that no longer resolve (e.g. deleted later
 *  in the same batch). Returns undefined when there is nothing, so the field stays off the response. */
export const resolvedElements = (space: Space, env: Env, refs: string[]): WriteElement[] | undefined => {
  const elements = refs
    .map(ref => {
      const uri = `plitzi://schema/${env}/elements/${ref}`;
      const res = readResource(space, env, uri);

      return res ? { uri, stateVersion: res.stateVersion, ...(res.data as AIElementDetail) } : undefined;
    })
    .filter((el): el is WriteElement => el !== undefined);

  return elements.length > 0 ? elements : undefined;
};

export const conflictMessage = 'Cannot apply: your data is stale. Re-read the changed resources and retry.';
