/** The bottom corner the dev-tools badge sits in. */
export type IndicatorSide = 'left' | 'right';

/** The side a badge dropped at `x` lands on: whichever half of its container the pointer let go in. */
export const sideAt = (x: number, container: { left: number; width: number }): IndicatorSide =>
  x < container.left + container.width / 2 ? 'left' : 'right';
