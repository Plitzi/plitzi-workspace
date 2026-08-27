import {
  FLEX_DIRECTIONS,
  FLEX_WRAPS,
  LENGTH_RE,
  NUMBER_RE,
  QUOTE_RE,
  splitOn,
  splitPair,
  splitTokens
} from './helpers';

import type { CssProps } from '../types';

// overflow: 1 value → both axes, 2 values → x y
export const expandOverflow = (value: string, out: CssProps): void => {
  const [x, y = x] = splitTokens(value);
  out['overflow-x'] = x;
  out['overflow-y'] = y;
};

// The single-keyword forms of `flex`, which are not grow/shrink/basis values but named triples.
const FLEX_KEYWORDS = new Map<string, [string, string, string]>([
  ['none', ['0', '0', 'auto']],
  ['auto', ['1', '1', 'auto']],
  ['initial', ['0', '1', 'auto']]
]);

const writeFlex = (out: CssProps, grow: string, shrink: string, basis: string): void => {
  out['flex-grow'] = grow;
  out['flex-shrink'] = shrink;
  out['flex-basis'] = basis;
};

// flex: 1–3 values → flex-grow, flex-shrink, flex-basis
export const expandFlex = (value: string, out: CssProps): void => {
  const tokens = splitTokens(value);
  if (tokens.length === 1) {
    const [only] = tokens;
    const keyword = FLEX_KEYWORDS.get(only);
    if (keyword) {
      writeFlex(out, ...keyword);
    } else if (NUMBER_RE.test(only)) {
      writeFlex(out, only, '1', '0%');
    } else {
      writeFlex(out, '1', '1', only);
    }

    return;
  }

  // Past one token the first is always flex-grow, so a non-numeric head is not a flex value at all — expanding it
  // would spread a typo across three longhands.
  const [grow, second, third] = tokens;
  if (!NUMBER_RE.test(grow)) {
    return;
  }

  if (tokens.length === 2) {
    if (NUMBER_RE.test(second)) {
      writeFlex(out, grow, second, '0%');
    } else {
      writeFlex(out, grow, '1', second);
    }
  } else {
    writeFlex(out, grow, second, third);
  }
};

// flex-flow: 1–2 values → flex-direction, flex-wrap
export const expandFlexFlow = (value: string, out: CssProps): void => {
  for (const token of splitTokens(value)) {
    if (FLEX_DIRECTIONS.has(token)) {
      out['flex-direction'] = token;
    } else if (FLEX_WRAPS.has(token)) {
      out['flex-wrap'] = token;
    }
  }
};

// place-content / place-items / place-self: 1–2 values → first = align-*, second = justify-*
export const expandPlacePair = (
  prefix: 'place-content' | 'place-items' | 'place-self',
  value: string,
  out: CssProps
): void => {
  const [align, justify = align] = splitTokens(value);
  const prop = prefix.slice('place-'.length);
  out[`align-${prop}`] = align;
  out[`justify-${prop}`] = justify;
};

// grid-row / grid-column: `start / end` (a lone value sets the start and leaves the end auto).
export const expandGridLine = (key: 'grid-row' | 'grid-column', value: string, out: CssProps): void => {
  const axis = key.slice('grid-'.length);
  const [start, end = 'auto'] = splitOn(value, '/');
  out[`grid-${axis}-start`] = start;
  out[`grid-${axis}-end`] = end;
};

// grid-area: `row-start / column-start / row-end / column-end`, each omitted part mirroring the one it pairs with.
export const expandGridArea = (value: string, out: CssProps): void => {
  const parts = splitOn(value, '/');
  const [rowStart, colStart = rowStart, rowEnd = colStart, colEnd = rowEnd] = parts;
  out['grid-row-start'] = rowStart;
  out['grid-column-start'] = colStart;
  out['grid-row-end'] = rowEnd;
  out['grid-column-end'] = colEnd;
};

// columns: a number is the count, anything else the width; two values give both.
export const expandColumns = (value: string, out: CssProps): void => {
  const tokens = splitTokens(value);
  if (tokens.length === 1) {
    const [only] = tokens;
    if (NUMBER_RE.test(only)) {
      out['column-count'] = only;
    } else {
      out['column-width'] = only;
    }
  } else if (tokens.length >= 2) {
    const [first, second] = tokens;
    const [width, count] = NUMBER_RE.test(first) ? [second, first] : [first, second];
    out['column-width'] = width;
    out['column-count'] = count;
  }
};

const isTrackList = (tokens: string[]): boolean =>
  tokens.some(
    token =>
      token === 'none' ||
      token === 'auto' ||
      token === 'min-content' ||
      token === 'max-content' ||
      token.startsWith('[') ||
      token.startsWith('minmax(') ||
      token.startsWith('repeat(') ||
      token.startsWith('fit-content(') ||
      LENGTH_RE.test(token) ||
      /^-?[\d.]+fr$/.test(token)
  );

// grid / grid-template: `rows / columns`, where the rows half may instead be a list of quoted area strings, each
// optionally followed by its row track size.
export const expandGridTemplate = (value: string, out: CssProps): void => {
  const [first, second] = splitPair(value, '/');
  const rowTokens = splitTokens(first);
  const areas = rowTokens.filter(token => QUOTE_RE.test(token));
  const sizes = rowTokens.filter(token => !QUOTE_RE.test(token));

  if (second !== undefined) {
    if (second !== '') {
      out['grid-template-columns'] = second;
    }
  } else if (areas.length === 0) {
    // Without a `/` and without area strings the value is not a legal `grid` shorthand at all. A bare track list is
    // read as the columns an agent meant to declare, which is the property it would otherwise have written by hand.
    if (isTrackList(rowTokens)) {
      out['grid-template-columns'] = first;
    }

    return;
  }

  if (areas.length > 0) {
    out['grid-template-areas'] = areas.join(' ');
  }

  if (sizes.length > 0) {
    out['grid-template-rows'] = sizes.join(' ');
  }
};
