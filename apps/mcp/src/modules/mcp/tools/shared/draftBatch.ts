import { expandOperations } from './expandOperations';
import { lintDraft } from './lintDraft';
import { validateOperations } from './validator';
import { cloneSpace } from '../../helpers';
import { applyOperations } from '../apply/dispatch';

import type { ValidationMode } from './validator/context';
import type { Space } from '../../helpers';
import type { Env, MutationOutcome, ValidationError } from '../../types';
import type { Operation } from '../operations';

export type DraftResult =
  | { ok: false; errors: ValidationError[]; warnings: string[] }
  | { ok: true; ops: Operation[]; draft: Space; outcome: MutationOutcome; warnings: string[] };

/**
 * A batch run on a copy of the space and read back — the one way every tool that takes operations handles them, so
 * `plitzi_validate` answers exactly what `plitzi_apply` would, and `plitzi_render` holds a widget to the same rules.
 *
 * In order: the sugar ops expanded, each op checked against the input it takes, the batch applied to the copy, and
 * the copy read by `lintDraft` — structure and meaning, the same reading every other writer gets. The first stage to
 * refuse ends it; the space handed in is never touched.
 */
export const draftBatch = (
  space: Space,
  env: Env,
  operations: Operation[],
  mode: ValidationMode = 'space'
): DraftResult => {
  const expansion = expandOperations(operations);
  if (expansion.errors.length > 0) {
    return { ok: false, errors: expansion.errors, warnings: [] };
  }

  const ops = expansion.operations;
  const validation = validateOperations(space, ops, mode);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const draft = cloneSpace(space);
  const outcome = applyOperations(draft, env, ops);
  if (outcome.errors.length > 0) {
    return { ok: false, errors: outcome.errors, warnings: validation.warnings };
  }

  const reading = lintDraft(draft, ops, space);
  const warnings = [...validation.warnings, ...reading.warnings];
  if (reading.errors.length > 0) {
    return { ok: false, errors: reading.errors, warnings };
  }

  return { ok: true, ops, draft, outcome, warnings };
};
