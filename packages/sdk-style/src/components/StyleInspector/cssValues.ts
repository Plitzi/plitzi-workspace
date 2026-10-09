import { get } from '@plitzi/plitzi-ui/helpers';

import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

/**
 * Reading CSS values that hold lists — shadows, filters, transitions, background layers — where a comma or a space
 * inside a function (`rgba(0, 0, 0, .5)`, `cubic-bezier(.4, 0, .2, 1)`) is not a separator.
 */

const splitOutsideParens = (value: string, separator: string, keepEmpty: boolean): string[] => {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of value) {
    if (char === separator && depth === 0) {
      if (keepEmpty || current) {
        result.push(current);
      }
      current = '';
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    }

    current += char;
  }

  if (current) {
    result.push(current);
  }

  return result;
};

/** `a,,b` keeps the empty middle: a list written with a gap in it is read with the gap. */
export const splitByCommaOutsideParens = (value: string): string[] => splitOutsideParens(value, ',', true);

/** Runs of spaces are one separator. */
export const splitBySpaceOutsideParens = (value: string): string[] => splitOutsideParens(value, ' ', false);

/**
 * A value with its tokens (`var(--accent)`, `{{ accent }}`) replaced by what the space's variables say they are — for
 * what the editor itself draws (a swatch, a preview), whose document has none of the space's custom properties. A
 * token the space does not declare stays as it was.
 */
export const resolveTokens = (value: string, variables: Record<string, unknown>): string => {
  let resolved = value;
  for (const match of value.matchAll(new RegExp(VARIABLE_REGEX, 'g'))) {
    const name = match[1] || match[2];
    const replacement = get(variables, name, undefined);
    if (typeof replacement === 'string' || typeof replacement === 'number') {
      resolved = resolved.replace(match[0], String(replacement));
    }
  }

  return resolved;
};

/** What a control answered as the text a stylesheet holds: a word or a number, and nothing for anything else. */
export const asText = (value: StyleValue | Record<StyleCategory, StyleValue> | boolean | undefined): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
