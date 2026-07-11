import { environment, operations } from './operations';
import { defineTool } from './tool';
import { validateOperations } from './validator';

import type { Space } from '../helpers';
import type { ValidateInput, ValidationResult } from '../types';

export const validateShape = { environment, operations };

export const validate = (input: ValidateInput, space: Space): ValidationResult =>
  validateOperations(space, input.operations);

export const validateTool = defineTool({
  name: 'plitzi_validate',
  title: 'Validate',
  description: 'Check a batch of operations without executing them. Returns teachable errors and warnings.',
  inputShape: validateShape,
  access: 'read',
  run: (input, ctx) => validate(input, ctx.space)
});
