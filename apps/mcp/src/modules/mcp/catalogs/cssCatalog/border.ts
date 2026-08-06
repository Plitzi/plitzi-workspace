import { BORDER_STYLES, BORDER_WIDTH_KEYWORDS, expandTo4, LENGTH_RE, SIDES, splitTokens } from './helpers';

import type { CssProps } from '../../types';

// The CSS initial value of each border/outline longhand, used when a shorthand omits it. Writing them explicitly
// keeps the atomic form faithful to the shorthand: `border: none` must clear a width/color a previous definition
// set, which a style-only expansion would leave behind.
const BORDER_INITIAL = { width: 'medium', style: 'none', color: 'currentcolor' } as const;

const classifyBorderToken = (token: string): 'width' | 'style' | 'color' => {
  if (BORDER_STYLES.has(token)) {
    return 'style';
  }

  if (BORDER_WIDTH_KEYWORDS.has(token) || LENGTH_RE.test(token)) {
    return 'width';
  }

  return 'color';
};

// Classify each token of a border/outline shorthand as width/style/color, filling the omitted ones with their CSS
// initial value.
export const classifyBorderTokens = (value: string): Record<'width' | 'style' | 'color', string> => {
  const parts = { ...BORDER_INITIAL } as Record<'width' | 'style' | 'color', string>;
  for (const token of splitTokens(value)) {
    parts[classifyBorderToken(token)] = token;
  }

  return parts;
};

// border / border-{side}: emit width/style/color longhands for the side(s) the key addresses.
export const expandBorder = (key: string, value: string, out: CssProps): void => {
  const sides = key === 'border' ? SIDES : ([key.slice('border-'.length)] as readonly string[]);
  const parts = classifyBorderTokens(value);
  for (const side of sides) {
    for (const [kind, token] of Object.entries(parts)) {
      out[`border-${side}-${kind}`] = token;
    }
  }
};

// border-width / border-color / border-style (1–4 values → {side}-{property})
export const expandBorderGroup = (suffix: string, value: string, out: CssProps): void => {
  const values = expandTo4(splitTokens(value));
  SIDES.forEach((side, index) => {
    out[`border-${side}-${suffix}`] = values[index];
  });
};
