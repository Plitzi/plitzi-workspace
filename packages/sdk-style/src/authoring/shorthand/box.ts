import { expandTo4, splitPair, splitTokens } from './helpers';

import type { CssProps } from '../types';

const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

// padding / margin / inset (1–4 values → top/right/bottom/left)
export const expandBox = (key: string, value: string, out: CssProps): void => {
  const [top, right, bottom, left] = expandTo4(splitTokens(value));
  const prefix = key === 'inset' ? '' : `${key}-`;
  out[`${prefix}top`] = top;
  out[`${prefix}right`] = right;
  out[`${prefix}bottom`] = bottom;
  out[`${prefix}left`] = left;
};

// border-radius (1–4 values → corners). The elliptical `h... / v...` form keeps both radii on each corner longhand,
// which is exactly the per-corner syntax (`border-top-left-radius: 10px 30px`).
export const expandBorderRadius = (value: string, out: CssProps): void => {
  const [horizontal, vertical] = splitPair(value, '/');
  const h = expandTo4(splitTokens(horizontal));
  const v = vertical === undefined ? undefined : expandTo4(splitTokens(vertical));
  CORNERS.forEach((corner, index) => {
    out[`border-${corner}-radius`] = v ? `${h[index]} ${v[index]}` : h[index];
  });
};

// gap (1–2 values → row-gap, column-gap)
export const expandGap = (value: string, out: CssProps): void => {
  const [row, col = row] = splitTokens(value);
  out['row-gap'] = row;
  out['column-gap'] = col;
};
