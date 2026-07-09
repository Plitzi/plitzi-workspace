import { resourceVersion } from '../resources';

import type { Operation } from './operations';
import type { Space } from '../helpers';
import type { Env, ValidationError } from '../types';
import type { Schema, Style } from '@plitzi/sdk-shared';

/** The element schema and the style schema persist independently (Space model / Style model), so each has
 *  its own optional persister. When one is absent, that schema is applied in memory but reported unsaved. */
export interface Persisters {
  schema?: (schema: Schema) => Promise<void>;
  style?: (style: Style) => Promise<void>;
}

export interface ApplyInput {
  environment?: string;
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

/** Lean write result: what changed and the new versions, never the full data (re-read a resource if needed). */
export interface WriteResponse {
  applied: boolean;
  persisted?: boolean;
  summary: { created: number; updated: number; deleted: number };
  changed: ChangedResource[];
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

export const conflictMessage = 'Cannot apply: your data is stale. Re-read the changed resources and retry.';
