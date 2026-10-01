/* eslint-disable quotes */

/**
 * Values written out as TypeScript: what every decompiler here emits with, so a space and an action read back into
 * code quote, key and name things the same way.
 */

/** Names a generated variable may not take: the language's own, and the authoring helpers a file imports. */
export const RESERVED = new Set(
  (
    'break case catch class const continue debugger default delete do else enum export extends false finally for ' +
    'function if import in instanceof new null return super switch this throw true try typeof var void while with ' +
    'yield let static implements interface package private protected public await element styles'
  ).split(' ')
);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const camel = (value: string): string => {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words
    .map((word, index) =>
      index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');

  return /^[0-9]/.test(joined) || !joined ? `c${joined}` : joined;
};

/** A name with a suffix it does not already end in — `docsPage`, never `analyticsPagePage`. */
export const withSuffix = (name: string, suffix: string): string => (name.endsWith(suffix) ? name : `${name}${suffix}`);

/** A string as a literal: a template literal when it spans lines — a stylesheet, a head snippet — and quotes when not. */
export const stringLiteral = (value: string): string =>
  value.includes('\n')
    ? `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``
    : `'${JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

export const keyLiteral = (key: string): string => (IDENTIFIER.test(key) ? key : stringLiteral(key));

/** Anything JSON-shaped, as a TypeScript literal. */
export const literal = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'string') {
    return stringLiteral(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(literal).join(', ')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, inner]) => inner !== undefined);

    return entries.length === 0
      ? '{}'
      : `{ ${entries.map(([key, inner]) => `${keyLiteral(key)}: ${literal(inner)}`).join(', ')} }`;
  }

  return 'null';
};
