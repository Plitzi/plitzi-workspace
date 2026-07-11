import { validateOperations } from './validator';

import type { Space } from '../helpers';
import type { ValidateInput, ValidationResult } from '../types';

export const validate = (input: ValidateInput, space: Space): ValidationResult =>
  validateOperations(space, input.operations);
