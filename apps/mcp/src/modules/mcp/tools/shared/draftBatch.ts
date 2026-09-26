import { expandOperations } from './expandOperations';
import { fixTouched, lintDraft } from './lintDraft';
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
 * In order: the sugar ops expanded; what was already wrong with the elements the batch touches fixed where it has one
 * reading (`fixTouched`, each fix said in `warnings`); each op checked against the input it takes; the batch applied to
 * the copy; and the copy read by `lintDraft` — structure and meaning, the same reading every other writer gets. The
 * first stage to refuse ends it; the space handed in is never touched.
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
  const prepared = fixTouched(space, ops);
  const validation = validateOperations(prepared.space, ops, mode);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors, warnings: [...prepared.fixed, ...validation.warnings] };
  }

  const draft = cloneSpace(prepared.space);
  const outcome = applyOperations(draft, env, ops);
  if (outcome.errors.length > 0) {
    return { ok: false, errors: outcome.errors, warnings: [...prepared.fixed, ...validation.warnings] };
  }

  const reading = lintDraft(draft, ops, prepared.space);
  const warnings = [...prepared.fixed, ...validation.warnings, ...reading.warnings];
  if (reading.errors.length > 0) {
    return { ok: false, errors: reading.errors, warnings };
  }

  return { ok: true, ops, draft, outcome, warnings };
};
