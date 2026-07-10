import { readResource, resourceVersion } from '../resources';

import type { Operation } from './operations';
import type { Space } from '../helpers';
import type { AIElementDetail, Env, ValidationError } from '../types';
import type { Schema, Style } from '@plitzi/sdk-shared';

/** The element schema and the style schema persist independently (Space model / Style model), so each has
 *  its own optional persister. When one is absent, that schema is applied in memory but reported unsaved. */
export interface Persisters {
  schema?: (schema: Schema) => Promise<void>;
  style?: (style: Style) => Promise<void>;
}

export interface ApplyInput {
  environment?: string;
  dryRun?: boolean;
  expectedResourceVersions?: Record<string, string>;
  operations: Operation[];
}

export interface Conflict {
  resourceUri: string;
  expectedVersion: string;
  currentVersion: string;
}

export interface ChangedResource {
  uri: string;
  stateVersion: string;
}

/** Full detail of a created/updated element, plus its own uri and stateVersion so a follow-up edit of the same
 *  element can guard with optimistic concurrency without an intermediate read. */
export type WriteElement = AIElementDetail & { uri: string; stateVersion: string };

/** Write result: what changed and the new versions, plus the full detail of every element created/updated (with
 *  its uri + stateVersion) so the caller has that context without a follow-up read. Other resources (pages,
 *  definitions, variables) still report only uri+version — re-read them if needed. */
export interface WriteResponse {
  applied: boolean;
  dryRun?: boolean;
  persisted?: boolean;
  summary: { created: number; updated: number; deleted: number };
  changed: ChangedResource[];
  elements?: WriteElement[];
  warnings?: string[];
  errors?: ValidationError[];
  conflict?: { message: string; conflicts: Conflict[] };
}

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
