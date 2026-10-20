import { validateBindingSources, validateBindings, validateInteractions, validateVariables } from './bindings';
import { validateComponents } from './components';
import { createValidationContext } from './context';
import {
  validateLayoutCycles,
  validateOrphanedElements,
  validatePageFolders,
  validatePages,
  validateRootConsistency
} from './pages';
import {
  validateCircularReferences,
  validateElementIds,
  validateElements,
  validateParentChildConsistency,
  validateStructure
} from './structure';

import type { SchemaValidationOptions, SchemaValidationResult } from './types';
import type { Schema } from '@plitzi/sdk-shared';

export { REFERENCE_ERROR_CODES, isIntegrityError } from './types';
export type { SchemaValidationError, SchemaValidationOptions, SchemaValidationResult } from './types';

// Run all validations
const validate = (schema: Schema, options?: SchemaValidationOptions): SchemaValidationResult => {
  const ctx = createValidationContext(schema, options);
  const { errors, warnings, baseElementId } = ctx;

  if (!validateStructure(ctx)) {
    return { valid: false, errors, warnings };
  }

  validateElements(ctx);
  validateParentChildConsistency(ctx);
  validateCircularReferences(ctx);
  validatePages(ctx);
  validateRootConsistency(ctx);
  validatePageFolders(ctx);
  validateLayoutCycles(ctx);
  validateOrphanedElements(ctx);
  validateVariables(ctx);
  validateElementIds(ctx);
  validateBindingSources(ctx, options?.sourceTypes);
  validateBindings(ctx);
  validateInteractions(ctx);
  if (!baseElementId) {
    validateComponents(ctx, validate);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// Export the validator function
export const validateSchema = (schema: Schema, options?: SchemaValidationOptions): SchemaValidationResult => {
  return validate(schema, options);
};

// Convenience function: throws if schema is invalid
export const assertSchemaValid = (schema: Schema, options?: SchemaValidationOptions, context?: string): void => {
  const result = validateSchema(schema, options);
  if (!result.valid) {
    const message = `Invalid schema${context ? ` (${context})` : ''}: ${result.errors.map(e => e.message).join('; ')}`;
    throw new Error(message);
  }
};

// Convenience function: returns true if schema is valid
export const isSchemaValid = (schema: Schema, options?: SchemaValidationOptions): boolean => {
  return validateSchema(schema, options).valid;
};
