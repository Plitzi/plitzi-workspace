import { applyOperations } from './apply/dispatch';
import { environment, operations } from './operations';
import { cloneSpace } from '../helpers';
import { defineTool } from './shared/tool';
import { validateOperations } from './shared/validator';
import { auditResources } from './shared/validator/audit';

import type { Space } from '../helpers';
import type { Env, ValidateInput, ValidationResult } from '../types';

export const validateShape = { environment, operations };

export const validate = (input: ValidateInput, space: Space): ValidationResult => {
  const validation = validateOperations(space, input.operations);
  if (!validation.valid) {
    return validation;
  }

  // Mirror apply: run the batch on a throwaway draft and audit every touched resource for PRE-EXISTING malformations,
  // so plitzi_validate surfaces exactly what plitzi_apply would block on (a broken transformer / invalid CSS / bad
  // node already living in a touched element or definition), without persisting.
  const env = (input.environment ?? 'main') as Env;
  const draft = cloneSpace(space);
  const outcome = applyOperations(draft, env, input.operations);
  if (outcome.errors.length > 0) {
    return { valid: false, errors: outcome.errors, warnings: validation.warnings };
  }

  const audit = auditResources(draft, input.operations);

  return {
    valid: audit.errors.length === 0,
    errors: audit.errors,
    warnings: [...validation.warnings, ...audit.warnings]
  };
};

export const validateTool = defineTool({
  name: 'plitzi_validate',
  title: 'Validate',
  description:
    'Check a batch of operations without executing them. Returns teachable errors and warnings — including any ' +
    'PRE-EXISTING malformation in a resource the batch touches (which blocks a save until fixed).',
  inputShape: validateShape,
  access: 'read',
  run: (input, ctx) => validate(input, ctx.space)
});
