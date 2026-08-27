import { validateSchema } from '@plitzi/sdk-schema/helpers/schemaValidator';

import { isCssProperty, isCustomProperty, suggestCssProperty } from '../style';

import type {
  SchemaValidationError,
  SchemaValidationOptions,
  SchemaValidationResult
} from '@plitzi/sdk-schema/helpers/schemaValidator';
import type { Schema, Style, StyleBlock } from '@plitzi/sdk-shared';

/**
 * Whether a pair of documents is a space that can be served.
 *
 * `validateSchema` answers for the schema alone, which is most of it but not all of it: a space is two documents,
 * and the style half carries rules of its own that can be as malformed as any element tree. This is the public
 * door for anyone holding a pair they did not author here — an export from the builder, a JSON someone edited by
 * hand, a document a self-hosted deployment is about to serve — and it is the same gate `authorSpace` puts its own
 * output through, so nothing gets a laxer reading for having come from a helper.
 */

export interface SpaceDocuments {
  schema: Schema;
  style: Style;
}

const eachRuleSet = (style: Style, visit: (rules: Record<string, unknown>, path: string) => void): void => {
  const visitBlock = (block: StyleBlock | undefined, path: string): void => {
    if (!block) {
      return;
    }

    if (block.default) {
      visit(block.default, path);
    }

    Object.entries(block.states ?? {}).forEach(([state, rules]) => visit(rules, `${path}:${state}`));
    Object.entries(block.variants ?? {}).forEach(([variant, inner]) => visitBlock(inner, `${path}--${variant}`));
  };

  Object.entries(style.platform).forEach(([breakpoint, items]) => {
    Object.entries(items).forEach(([name, item]) => {
      Object.entries(item.attributes).forEach(([selector, block]) =>
        visitBlock(block, `${breakpoint}.${name}.${selector}`)
      );
    });
  });
};

/** Every property written anywhere in the style must be one the style editor can read back. */
const validateStyle = (style: Style): SchemaValidationError[] => {
  const errors: SchemaValidationError[] = [];

  eachRuleSet(style, (rules, path) => {
    Object.keys(rules).forEach(property => {
      if (isCssProperty(property) || isCustomProperty(property)) {
        return;
      }

      const suggestion = suggestCssProperty(property);
      errors.push({
        code: 'UNKNOWN_CSS_PROPERTY',
        message: `Style "${path}" declares "${property}", which is not a CSS property Plitzi can read back${
          suggestion ? ` — did you mean "${suggestion}"?` : ''
        }`,
        details: { path, property }
      });
    });
  });

  return errors;
};

export const validateSpace = (
  { schema, style }: SpaceDocuments,
  options: SchemaValidationOptions = {}
): SchemaValidationResult => {
  const schemaResult = validateSchema(schema, options);
  const errors = [...schemaResult.errors, ...validateStyle(style)];

  return { valid: errors.length === 0, errors, warnings: schemaResult.warnings };
};

/** The throwing flavour. Returns what was survivable so a caller can decide what to do about it. */
export const assertSpaceValid = (
  space: SpaceDocuments,
  context: string,
  options: SchemaValidationOptions = {}
): SchemaValidationError[] => {
  const { valid, errors, warnings } = validateSpace(space, options);
  if (!valid) {
    throw new Error(
      `Invalid space (${context}):\n${errors.map(error => `  - [${error.code}] ${error.message}`).join('\n')}`
    );
  }

  return warnings;
};
