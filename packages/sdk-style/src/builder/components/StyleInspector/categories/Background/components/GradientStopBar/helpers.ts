import { serializeStop } from '../../helpers/backgroundParser';

import type { GradientStop } from '../../helpers/backgroundParser';

/** Where a stop sits along the bar, in percent — its first position when it has two, 0 when it has none. */
export const stopPct = (position: string): number => {
  const n = parseFloat(position);

  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
};

export const sortStops = (stops: GradientStop[]): GradientStop[] =>
  [...stops].sort((a, b) => stopPct(a.position) - stopPct(b.position));

/** The stops drawn left to right on the bar, whatever the gradient's own direction or shape. */
export const stopsPreview = (stops: GradientStop[]): string =>
  `linear-gradient(90deg, ${sortStops(stops).map(serializeStop).join(', ')})`;

/** The color the stops have at a point of the bar — the closest stop's — for a stop added there. */
export const colorNear = (stops: GradientStop[], pct: number): string =>
  [...stops].sort((a, b) => Math.abs(stopPct(a.position) - pct) - Math.abs(stopPct(b.position) - pct)).at(0)?.color ??
  '#808080';
