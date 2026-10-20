/**
 * JSON as the project's Prettier leaves it (`printWidth` 120, two spaces): an object one key a line, a list of plain
 * values on one line when it fits — so a file the CLI writes into the project (`.plitzi/team.json`, at `create` and
 * with each `run team set`) passes the project's own format check as written, with no Prettier at hand to ask.
 */

const PRINT_WIDTH = 120;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isPlain = (value: Json): boolean =>
  value === null ||
  typeof value !== 'object' ||
  (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0);

/** `value` at `indent`, its first line starting `column` characters in and followed by `after` (a comma, or nothing). */
const print = (value: Json, indent: string, column: number, after: number): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (value.every(isPlain)) {
      const flat = `[${value.map(each => print(each, inner, 0, 0)).join(', ')}]`;
      if (column + flat.length + after <= PRINT_WIDTH) {
        return flat;
      }
    }

    const lines = value.map(
      (each, index) => `${inner}${print(each, inner, inner.length, index < value.length - 1 ? 1 : 0)}`
    );

    return `[\n${lines.join(',\n')}\n${indent}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }

  const lines = entries.map(([key, each], index) => {
    const head = `${inner}${JSON.stringify(key)}: `;

    return `${head}${print(each, inner, head.length, index < entries.length - 1 ? 1 : 0)}`;
  });

  return `{\n${lines.join(',\n')}\n${indent}}`;
};

/** The file's text: `value` formatted, and the newline a file ends with. */
export const formattedJson = (value: unknown): string => {
  // Through JSON first: what is written is what JSON keeps — no `undefined`, no class — whatever `value` was typed as.
  const plain = JSON.parse(JSON.stringify(value)) as Json;

  return `${print(plain, '', 0, 0)}\n`;
};
