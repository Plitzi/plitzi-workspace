import { environment, operations } from './operations';
import { draftBatch } from './shared/draftBatch';
import { defineTool } from './shared/tool';

import type { Space } from '../helpers';
import type { Env, ValidateInput, ValidationResult } from '../types';

export const validateShape = { environment, operations };

export const validate = (input: ValidateInput, space: Space): ValidationResult => {
  // Exactly what plitzi_apply would do, on a throwaway copy — so what this answers is what apply would block on,
  // including a PRE-EXISTING malformation in anything the batch touches.
  const result = draftBatch(space, (input.environment ?? 'main') as Env, input.operations);

  if (!result.ok) {
    return { valid: false, errors: result.errors, warnings: result.warnings };
  }

  return {
    valid: true,
    errors: [],
    warnings: result.warnings,
    ...(result.suggestions.length > 0 ? { suggestions: result.suggestions } : {})
  };
};

export const validateTool = defineTool({
  name: 'plitzi_validate',
  title: 'Validate',
  description:
    'Check a batch of operations without executing them. Returns teachable errors and warnings — including any ' +
    'PRE-EXISTING malformation in a resource the batch touches (which blocks a save until fixed) — and suggestions: ' +
    'shorter ways to the same page the batch opens up (a layout, a component, an element’s own content).',
  inputShape: validateShape,
  access: 'read',
  run: (input, ctx) => validate(input, ctx.space)
});
