import { validateOperations } from './validator';

import type { Operation } from './operations';
import type { ValidationResult } from './validator';
import type { Space } from '../helpers';

export interface ValidateInput {
  environment?: string;
  operations: Operation[];
}

export const validate = (input: ValidateInput, space: Space): ValidationResult =>
  validateOperations(space, input.operations);
