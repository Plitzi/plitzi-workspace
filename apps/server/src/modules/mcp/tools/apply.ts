import { validateSchema } from '@plitzi/sdk-schema';

import { cloneSpace } from '../helpers';
import { applyOperations } from './mutate';
import { changedResources, conflictMessage, detectConflicts, resolvedElements } from './state';
import { validateOperations } from './validator';

import type { ApplyInput, Persisters, WriteResponse } from './state';
import type { Space } from '../helpers';
import type { Env, ValidationError } from '../types';
import type { SchemaValidationError } from '@plitzi/sdk-schema';

const noWarnings = (warnings: string[]): string[] | undefined => (warnings.length > 0 ? warnings : undefined);

// Post-apply integrity: the canonical schema validator (@plitzi/sdk-schema) catches any structural corruption the
// ops would produce — orphaned/inconsistent parent-child links, cycles, bad rootIds — that the per-op checks miss.
// A failure here rejects the whole batch (the draft is discarded, nothing persists), so apply stays all-or-nothing.
const schemaErrorToValidation = (error: SchemaValidationError): ValidationError => ({
  path: error.elementId ? `schema.${error.elementId}` : 'schema',
  message: error.message,
  hint: 'This batch would leave the schema inconsistent (broken parent/child link or a cycle); nothing was applied.'
});

export const apply = async (input: ApplyInput, space: Space, persisters?: Persisters): Promise<WriteResponse> => {
  const env = (input.environment ?? 'main') as Env;

  const validation = validateOperations(space, input.operations);
  if (!validation.valid) {
    return {
      applied: false,
      persisted: false,
      summary: { created: 0, updated: 0, deleted: 0 },
      changed: [],
      errors: validation.errors,
      warnings: noWarnings(validation.warnings)
    };
  }

  const conflicts = detectConflicts(space, env, input.expectedResourceVersions);
  if (conflicts.length > 0) {
    return {
      applied: false,
      persisted: false,
      summary: { created: 0, updated: 0, deleted: 0 },
      changed: [],
      conflict: { message: conflictMessage, conflicts }
    };
  }

  const draft = cloneSpace(space);
  const outcome = applyOperations(draft, env, input.operations);
  if (outcome.errors.length > 0) {
    return {
      applied: false,
      persisted: false,
      summary: { created: 0, updated: 0, deleted: 0 },
      changed: [],
      errors: outcome.errors,
      warnings: noWarnings(validation.warnings)
    };
  }

  const integrity = validateSchema(draft.schema);
  if (!integrity.valid) {
    return {
      applied: false,
      persisted: false,
      summary: { created: 0, updated: 0, deleted: 0 },
      changed: [],
      errors: integrity.errors.map(schemaErrorToValidation),
      warnings: noWarnings(validation.warnings)
    };
  }

  // Dry run: everything is applied to the in-memory draft and reported (changed versions + full element detail),
  // but nothing is persisted — the agent inspects the outcome, then re-runs without dryRun to commit.
  if (input.dryRun) {
    return {
      applied: false,
      dryRun: true,
      summary: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted },
      changed: changedResources(draft, env, outcome.staleResources),
      elements: resolvedElements(draft, env, outcome.elementRefs),
      warnings: noWarnings(validation.warnings)
    };
  }

  // Persist each schema that changed to its own store; unsaved when a changed schema has no persister.
  let persisted = true;
  if (outcome.changedSchema) {
    if (persisters?.schema) {
      await persisters.schema(draft.schema);
    } else {
      persisted = false;
    }
  }

  if (outcome.changedStyle) {
    if (persisters?.style) {
      await persisters.style(draft.style);
    } else {
      persisted = false;
    }
  }

  return {
    applied: true,
    persisted,
    summary: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted },
    changed: changedResources(draft, env, outcome.staleResources),
    elements: resolvedElements(draft, env, outcome.elementRefs),
    warnings: noWarnings(validation.warnings)
  };
};
