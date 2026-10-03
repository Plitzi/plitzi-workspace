/* eslint-disable quotes */

/**
 * A stylesheet read as its top-level segments, by a scanner that knows strings, comments and nesting and nothing more.
 *
 * It does not interpret CSS: what its readers recognise in a segment they act on, and whatever they do not they keep
 * as text. An at-rule's block is handed over whole, to be read again with the same scanner when its reader needs to.
 */

export type StylesheetSegment =
  | { kind: 'rule'; selector: string; body: string; text: string }
  | { kind: 'atRule'; prelude: string; body: string; text: string }
  | { kind: 'other'; text: string };

const QUOTES = new Set(['"', "'"]);

/** Splits at `separator` where it is not inside a string, a comment or brackets. */
export const splitTopLevel = (text: string, separator: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = '';
      }

      continue;
    }

    if (QUOTES.has(char)) {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(text.slice(start));

  return parts;
};

/** The stylesheet as top-level segments: plain rules, at-rules with a block, and everything else (comments, space). */
export const stylesheetSegments = (stylesheet: string): StylesheetSegment[] => {
  const segments: StylesheetSegment[] = [];
  let index = 0;
  let pending = '';
  while (index < stylesheet.length) {
    if (stylesheet.startsWith('/*', index)) {
      const end = stylesheet.indexOf('*/', index + 2);
      const stop = end === -1 ? stylesheet.length : end + 2;
      pending += stylesheet.slice(index, stop);
      index = stop;
      continue;
    }

    const open = stylesheet.indexOf('{', index);
    if (open === -1) {
      pending += stylesheet.slice(index);
      break;
    }

    // Everything up to the brace is the prelude; a comment inside it is not something this scanner reads through.
    const prelude = stylesheet.slice(index, open);
    if (prelude.includes('/*')) {
      const comment = stylesheet.indexOf('/*', index);
      pending += stylesheet.slice(index, comment);
      index = comment;
      continue;
    }

    let depth = 1;
    let cursor = open + 1;
    let quote = '';
    for (; cursor < stylesheet.length && depth > 0; cursor += 1) {
      const char = stylesheet[cursor];
      if (quote) {
        if (char === '\\') {
          cursor += 1;
        } else if (char === quote) {
          quote = '';
        }
      } else if (QUOTES.has(char)) {
        quote = char;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }
    }

    const leading = prelude.match(/^\s*/)?.[0] ?? '';
    const selector = prelude.trim();
    const text = stylesheet.slice(index + leading.length, cursor);
    const body = stylesheet.slice(open + 1, cursor - 1);
    if (pending || leading) {
      segments.push({ kind: 'other', text: pending + leading });
      pending = '';
    }

    segments.push(
      selector.startsWith('@')
        ? { kind: 'atRule', prelude: selector, body, text }
        : { kind: 'rule', selector, body, text }
    );
    index = cursor;
  }

  if (pending) {
    segments.push({ kind: 'other', text: pending });
  }

  return segments;
};

/** A rule body's declarations as `[property, value]`, property lower-cased; nested blocks and comments are not read. */
export const declarationsIn = (body: string): [string, string][] =>
  splitTopLevel(body, ';').flatMap(declaration => {
    const colon = declaration.indexOf(':');
    if (colon === -1) {
      return [];
    }

    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();

    return property && value ? [[property.startsWith('--') ? property : property.toLowerCase(), value]] : [];
  });
