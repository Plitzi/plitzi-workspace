// Character classification shared across the parser, template cache and fast paths. Centralised so the
// definition of an "identifier character" — and every magic char code the scanners branch on — lives in
// exactly one place instead of being re-derived per file.

// Named char codes, used by the scanners instead of bare numeric literals.
export const Char = {
  Tab: 9,
  Newline: 10,
  Space: 32,
  Bang: 33, // !
  DoubleQuote: 34,
  Percent: 37,
  SingleQuote: 39,
  LParen: 40,
  RParen: 41,
  Star: 42,
  Plus: 43,
  Comma: 44,
  Minus: 45,
  Dot: 46,
  Slash: 47,
  Zero: 48,
  Nine: 57,
  Colon: 58,
  Less: 60,
  Equals: 61,
  Greater: 62,
  Question: 63,
  LBracket: 91,
  RBracket: 93,
  Underscore: 95,
  LBrace: 123,
  Pipe: 124,
  Tilde: 126
} as const;

// Valid first character of an identifier: [a-zA-Z_].
export const isIdentStart = (c: number): boolean =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === Char.Underscore;

// Valid subsequent identifier character: [a-zA-Z0-9_].
export const isIdentPart = (c: number): boolean => isIdentStart(c) || (c >= Char.Zero && c <= Char.Nine);

// Valid character inside a path/function segment: identifier chars plus internal hyphens (idRef segments).
export const isPathPart = (c: number): boolean => isIdentPart(c) || c === Char.Minus;

export const isDigit = (c: number): boolean => c >= Char.Zero && c <= Char.Nine;

export const isSpace = (c: number): boolean => c === Char.Space || c === Char.Tab;

// Whether the whole string is a bare identifier: `name`, `_id`, `item0` (no dots, no other characters).
export const isSimpleIdentifier = (s: string): boolean => {
  const len = s.length;
  if (len === 0 || !isIdentStart(s.charCodeAt(0))) {
    return false;
  }

  for (let i = 1; i < len; i++) {
    if (!isIdentPart(s.charCodeAt(i))) {
      return false;
    }
  }

  return true;
};

// Whether the whole string is a dotted path of identifier segments: `user.name`, `a.b.c` (every segment a
// bare identifier, no leading/trailing/empty segments).
export const isDottedPath = (s: string): boolean => {
  const len = s.length;
  if (len === 0) {
    return false;
  }

  let segmentStart = true;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c === Char.Dot) {
      if (segmentStart) {
        return false; // empty segment (leading dot or `..`)
      }
      segmentStart = true;
    } else {
      if (segmentStart && !isIdentStart(c)) {
        return false;
      }
      if (!segmentStart && !isIdentPart(c)) {
        return false;
      }
      segmentStart = false;
    }
  }

  return !segmentStart; // reject a trailing dot
};

// Whether the whole string is a valid loop-variable name (a bare identifier).
export const isVariableName = (s: string): boolean => isSimpleIdentifier(s);
