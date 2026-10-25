import { MOVING_PERCENT } from './types';

import type { RegionChange, ShotReport } from './types';

/**
 * What moved over the frames, by region. A part asked for by name moves when any of it changed: a few cells of pixel
 * art turning in a large clip are under a whole page's share for carets and anti-aliasing — encore-4's reels "moved
 * nothing" while they turned. A page's region under it is said apart, never dropped.
 */
export const framesOf = (
  moved: readonly RegionChange[],
  wholePage: boolean,
  count: number,
  every: number
): NonNullable<ShotReport['frames']> => {
  const moves = wholePage ? MOVING_PERCENT : 0;

  return {
    count,
    every,
    moving: moved.filter(region => region.changed > moves),
    slight: moved.filter(region => region.changed > 0 && region.changed <= moves),
    still: moved.filter(region => region.changed <= moves).map(region => region.name)
  };
};
