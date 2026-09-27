import { validateSchema } from '@plitzi/sdk-schema/helpers/schemaValidator';
import { styleWithoutTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';

import { lintSpace } from './lint';
import { isCssProperty, isCustomProperty, suggestCssProperty } from '../style';

import type { LintCatalogs } from './lint';
import type { AllowedBreak } from './types';
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

/** Style the page will never show: on an element that renders nothing of its own. Needs both documents. */
const validateStyleTargets = (schema: Schema, style: Style): SchemaValidationError[] =>
  Object.values(schema.flat).flatMap(element => {
    const issue = styleWithoutTag(element, style);

    return issue
      ? [{ code: 'STYLE_WITHOUT_TAG', message: `Element "${element.id}" ${issue}`, elementId: element.id }]
      : [];
  });

/** The structure's options, and the catalogues the linter reads what the documents mean against. */
export type SpaceValidationOptions = SchemaValidationOptions & LintCatalogs;

export const validateSpace = (
  { schema, style }: SpaceDocuments,
  options: SpaceValidationOptions = {}
): SchemaValidationResult => {
  const schemaResult = validateSchema(schema, options);
  const structural = [...schemaResult.errors, ...validateStyle(style)];
  // The linter reads a document whose structure holds: on a broken one it would only report the breakage again, in
  // other words and from further away.
  const lint = structural.length === 0 ? lintSpace({ schema, style }, options) : { errors: [], warnings: [] };
  const errors = [...structural, ...lint.errors];

  return {
    valid: errors.length === 0,
    errors,
    warnings: [...schemaResult.warnings, ...validateStyleTargets(schema, style), ...lint.warnings]
  };
};

/**
 * The throwing flavour. Returns what was survivable so a caller can decide what to do about it.
 *
 * `allow` turns the refusals it names into warnings (see `AllowedBreak`), and refuses an entry that names nothing.
 */
export const assertSpaceValid = (
  space: SpaceDocuments,
  context: string,
  options: SpaceValidationOptions = {},
  allow: readonly AllowedBreak[] = []
): SchemaValidationError[] => {
  const result = validateSpace(space, options);
  const allowed = (error: SchemaValidationError): AllowedBreak | undefined =>
    allow.find(entry => entry.code === error.code && entry.element === error.elementId);
  const errors = result.errors.filter(error => !allowed(error));
  const stale = allow.filter(entry => !result.errors.some(error => allowed(error) === entry));
  const refusals = [
    ...errors.map(error => `  - [${error.code}] ${error.message}`),
    ...stale.map(
      entry =>
        `  - [allow] "${entry.code}" on "${entry.element}" is allowed, but nothing raised it — remove it from \`allow\``
    )
  ];
  if (refusals.length > 0) {
    throw new Error(`Invalid space (${context}):\n${refusals.join('\n')}`);
  }

  return [
    ...result.errors.flatMap(error => {
      const entry = allowed(error);

      return entry ? [{ ...error, message: `Allowed (${entry.why}): ${error.message}` }] : [];
    }),
    ...result.warnings
  ];
};
