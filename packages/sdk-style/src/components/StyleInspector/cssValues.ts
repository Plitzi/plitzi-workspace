import { get } from '@plitzi/plitzi-ui/helpers';

import { VARIABLE_REGEX } from '@plitzi/sdk-shared/schema/schemaConstants';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

/**
 * Reading CSS values that hold lists — shadows, filters, transitions, background layers — where a comma or a space
 * inside a function (`rgba(0, 0, 0, .5)`, `cubic-bezier(.4, 0, .2, 1)`) is not a separator.
 */

export const splitByCommaOutsideParens = (value: string): string[] => {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
};

export const splitBySpaceOutsideParens = (value: string): string[] => {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ' ' && depth === 0) {
      if (current) {
        result.push(current);
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
};

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
