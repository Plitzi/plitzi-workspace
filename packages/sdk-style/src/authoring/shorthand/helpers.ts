// --- Value splitting ----------------------------------------------------------------------------------

// Walk a value, reporting whether each character sits at the top level — outside parentheses and outside quotes —
// so `rgb(0, 0, 0)`, `var(--x)`, a quoted grid area and a quoted font family are never split apart.
const walkTopLevel = (value: string, onChar: (ch: string, topLevel: boolean) => void): void => {
  let depth = 0;
  let quote = '';
  for (const ch of value) {
    if (quote) {
      onChar(ch, false);
      if (ch === quote) {
        quote = '';
      }

      continue;
    }

    if (/["']/.test(ch)) {
      quote = ch;
      onChar(ch, false);
      continue;
    }

    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    }

    onChar(ch, depth === 0);
  }
};

/** Split a shorthand value into whitespace-separated tokens, keeping parenthesized and quoted runs whole. */
export const splitTokens = (value: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  walkTopLevel(value.trim(), (ch, topLevel) => {
    if (topLevel && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  });

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

/** Split a value on a top-level separator. Used for the comma-separated layers of transition/animation/background
 *  and for the `/` of border-radius/grid-template/grid-row. */
export const splitOn = (value: string, separator: ',' | '/'): string[] => {
  const parts: string[] = [];
  let current = '';
  walkTopLevel(value, (ch, topLevel) => {
    if (topLevel && ch === separator) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  });

  parts.push(current);

  return parts.map(part => part.trim());
};

/** Split a value on its first top-level `/` — the `a / b` form of border-radius, grid-template, background and
 *  font. Returns the half after the slash as undefined when there is none, which is what tells those expanders the
 *  second half was not declared at all. */
export const splitPair = (value: string, separator: '/'): [string, string | undefined] => {
  const [first, ...rest] = splitOn(value, separator);

  return [first, rest.length > 0 ? rest.join(separator) : undefined];
};

// --- Shared regex patterns ---------------------------------------------------------------------------

export const TIME_RE = /^-?[\d.]+(ms|s)$/;
export const NUMBER_RE = /^-?[\d.]+$/;
/** A numeric value with an optional unit or `%` — matches both `12px` and `50%`. */
export const LENGTH_RE = /^-?[\d.]+([a-z%]*)$/;
export const QUOTE_RE = /^['"]/;

// --- Box shorthand helpers (1–4 values → top/right/bottom/left) --------------------------------------

/** Resolve the 1–4 value syntax shared by padding/margin/inset (top/right/bottom/left) and border-radius
 *  (top-left/top-right/bottom-right/bottom-left): 1 value fills all, 2 pair up, 3 leave the 4th mirroring the 2nd. */
export const expandTo4 = (tokens: string[]): [string, string, string, string] => {
  const [a, b = a, c = a, d = b] = tokens;

  return [a, b, c, d];
};

// --- Keyword sets for shorthand token classification ------------------------------------------------

export const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export const FLEX_DIRECTIONS = new Set(['row', 'row-reverse', 'column', 'column-reverse']);
export const FLEX_WRAPS = new Set(['nowrap', 'wrap', 'wrap-reverse']);

export const LIST_STYLE_TYPES = new Set([
  'disc',
  'circle',
  'square',
  'decimal',
  'decimal-leading-zero',
  'lower-roman',
  'upper-roman',
  'lower-alpha',
  'upper-alpha',
  'lower-greek',
  'lower-latin',
  'upper-latin',
  'armenian',
  'georgian',
  'none'
]);
export const LIST_STYLE_POSITIONS = new Set(['inside', 'outside']);

export const TEXT_DECORATION_LINES = new Set(['underline', 'overline', 'line-through', 'blink', 'none']);
export const TEXT_DECORATION_STYLES = new Set(['solid', 'double', 'dotted', 'dashed', 'wavy']);

const TIMING_FUNCTIONS = new Set(['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end']);

/** A timing function may also be a function call — cubic-bezier(…) or steps(…). */
export const isTimingFunction = (token: string): boolean =>
  TIMING_FUNCTIONS.has(token) || token.startsWith('cubic-bezier(') || token.startsWith('steps(');

export const ANIMATION_DIRECTIONS = new Set(['normal', 'reverse', 'alternate', 'alternate-reverse']);
export const ANIMATION_FILL_MODES = new Set(['none', 'forwards', 'backwards', 'both']);
export const ANIMATION_PLAY_STATES = new Set(['running', 'paused']);

export const FONT_STYLE_KEYWORDS = new Set(['normal', 'italic', 'oblique']);
export const FONT_VARIANT_KEYWORDS = new Set(['normal', 'small-caps']);
export const FONT_WEIGHT_KEYWORDS = new Set([
  'normal',
  'bold',
  'bolder',
  'lighter',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900'
]);

export const BORDER_STYLES = new Set([
  'none',
  'hidden',
  'dotted',
  'dashed',
  'solid',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset'
]);
export const BORDER_WIDTH_KEYWORDS = new Set(['thin', 'medium', 'thick']);
