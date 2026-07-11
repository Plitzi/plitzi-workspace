import styleConstants from '@plitzi/sdk-shared/style/styleConstants';

import type { CssProps } from '../../types';

/** Every kebab-case CSS property Plitzi's style engine understands. Values written to a definition
 *  must use these exact keys — camelCase or unknown keys are rejected by the validator. */
export const cssProperties: string[] = Array.from(new Set(Object.values(styleConstants))).sort();

const cssPropertySet = new Set(cssProperties);

export const isCssProperty = (key: string): boolean => cssPropertySet.has(key);

const toKebab = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** If a camelCase key maps to a known kebab-case property, return it — used to teach the agent the correct key. */
export const suggestCssProperty = (key: string): string | undefined => {
  const kebab = toKebab(key);

  return cssPropertySet.has(kebab) ? kebab : undefined;
};

// --- Shorthand expansion (RFC 0004 I4) -------------------------------------------------------------------------
// The style engine only understands longhand keys. Agents naturally write CSS shorthands (border, border-radius,
// padding…), so expand the unambiguous, high-frequency ones into longhands before validation/persistence. Anything
// not recognized here passes through unchanged, so the longhand-only check still rejects genuinely unknown keys.

// Split a shorthand value into tokens on whitespace, but never inside parentheses (so rgb(0, 0, 0) / var(--x)
// stay whole).
const splitTokens = (value: string): string[] => {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value.trim()) {
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (/\s/.test(ch) && depth === 0) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

// The four values of a 1–4 value box shorthand (padding/margin/inset), in top/right/bottom/left order.
const box4 = (tokens: string[]): [string, string, string, string] => {
  const [a, b = a, c = a, d = b] = tokens;

  return [a, b, c, d];
};

// border-radius corner order (TL, TR, BR, BL) from its 1–4 value syntax.
const radius4 = (tokens: string[]): [string, string, string, string] => {
  const [a, b = a, c = a, d = b] = tokens;

  return [a, b, c, d];
};

const BORDER_STYLES = new Set([
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
const BORDER_WIDTH_KEYWORDS = new Set(['thin', 'medium', 'thick']);
const LENGTH_RE = /^-?[\d.]+([a-z%]*)$/;

const classifyBorderToken = (token: string): 'width' | 'style' | 'color' => {
  if (BORDER_STYLES.has(token)) {
    return 'style';
  }

  if (BORDER_WIDTH_KEYWORDS.has(token) || LENGTH_RE.test(token)) {
    return 'width';
  }

  return 'color';
};

// border / border-{side}: classify each token as width/style/color and emit the matching longhands for the side(s).
const expandBorder = (key: string, value: string, out: CssProps): void => {
  const sides = key === 'border' ? SIDES : ([key.slice('border-'.length)] as readonly string[]);
  for (const token of splitTokens(value)) {
    const kind = classifyBorderToken(token);
    for (const side of sides) {
      out[`border-${side}-${kind}`] = token;
    }
  }
};

const BORDER_SIDE_KEYS = new Set(SIDES.map(s => `border-${s}`));

const expandOne = (key: string, raw: string | number, out: CssProps): boolean => {
  const value = String(raw);
  if (key === 'padding' || key === 'margin' || key === 'inset') {
    const [t, r, b, l] = box4(splitTokens(value));
    // inset longhands are the bare sides (top/right/bottom/left); padding/margin longhands are padding-top etc.
    const prefix = key === 'inset' ? '' : `${key}-`;
    out[`${prefix}top`] = t;
    out[`${prefix}right`] = r;
    out[`${prefix}bottom`] = b;
    out[`${prefix}left`] = l;

    return true;
  }

  if (key === 'border-radius' && !value.includes('/')) {
    const [tl, tr, br, bl] = radius4(splitTokens(value));
    const corners: Array<[string, string]> = [
      ['top-left', tl],
      ['top-right', tr],
      ['bottom-right', br],
      ['bottom-left', bl]
    ];
    for (const [corner, v] of corners) {
      out[`border-${corner}-radius`] = v;
    }

    return true;
  }

  if (key === 'gap') {
    const [row, col = row] = splitTokens(value);
    out['row-gap'] = row;
    out['column-gap'] = col;

    return true;
  }

  if (key === 'border' || BORDER_SIDE_KEYS.has(key)) {
    expandBorder(key, value, out);

    return true;
  }

  return false;
};

/** Expand supported CSS shorthands to their longhand keys. Explicit longhands in the same map win over any
 *  expansion (so `{ padding: 8, padding-left: 0 }` keeps padding-left: 0). Unrecognized keys pass through. */
export const expandShorthand = (css: CssProps): CssProps => {
  const expanded: CssProps = {};
  const direct: CssProps = {};
  for (const [key, value] of Object.entries(css)) {
    if (!expandOne(key, value, expanded)) {
      direct[key] = value;
    }
  }

  return { ...expanded, ...direct };
};
