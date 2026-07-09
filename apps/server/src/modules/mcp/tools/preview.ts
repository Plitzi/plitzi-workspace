import { cloneSpace } from '../helpers';
import { applyOperations } from './mutate';
import { changedResources, conflictMessage, detectConflicts } from './state';
import { validateOperations } from './validator';

import type { ApplyInput, WriteResponse } from './state';
import type { Space } from '../helpers';
import type { Env } from '../types';

export const preview = (input: ApplyInput, space: Space): WriteResponse => {
  const env = (input.environment ?? 'main') as Env;

  const validation = validateOperations(space, input.operations);
  const conflicts = detectConflicts(space, env, input.expectedResourceVersions);

  const draft = cloneSpace(space);
  const outcome = validation.valid && conflicts.length === 0 ? applyOperations(draft, env, input.operations) : null;

  const errors = [...validation.errors, ...(outcome?.errors ?? [])];
  const stale = outcome?.staleResources ?? [];

  return {
    applied: false,
    summary: {
      created: outcome?.created ?? 0,
      updated: outcome?.updated ?? 0,
      deleted: outcome?.deleted ?? 0
    },
    changed: changedResources(draft, env, stale),
    warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
    conflict: conflicts.length > 0 ? { message: conflictMessage, conflicts } : undefined
  };
};
