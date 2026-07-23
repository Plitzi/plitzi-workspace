import { Char, isSpace } from '../charClass';

// Returns the leading run of non-whitespace characters — the tag keyword (`if`, `for`, `endfor`, …).
export const extractFirstWord = (s: string): string => {
  let i = 0;
  while (i < s.length && !isSpace(s.charCodeAt(i))) {
    i++;
  }

  return s.slice(0, i);
};

// Splits a `{% for %}` collection on the Twig range operator `..`, ignoring `..` inside quotes and single dots
// (decimals). Returns the two bound strings, or null when the collection is not a range. Each bound is then
// parsed through the ordinary expression parser, so `0..n`, `-2..2` and `start..end` all work.
export const splitRange = (s: string): [string, string] | null => {
  let quote = 0;
  for (let i = 0; i + 1 < s.length; i++) {
    const c = s.charCodeAt(i);
    if (quote !== 0) {
      if (c === quote) {
        quote = 0;
      }
    } else if (c === Char.SingleQuote || c === Char.DoubleQuote) {
      quote = c;
    } else if (c === Char.Dot && s.charCodeAt(i + 1) === Char.Dot) {
      return [s.slice(0, i).trim(), s.slice(i + 2).trim()];
    }
  }

  return null;
};
