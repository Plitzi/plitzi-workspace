/**
 * `plitzi page shot`: a picture of one page of the project — and, asked, the numbers that say what a picture would.
 *
 *   plitzi page shot /about --width 390 --scheme dark
 *   plitzi page shot / --compare https://example.com --width 1440     # beside another site: what differs, and how
 *   plitzi page shot / --frames 4 --every 500                         # what moves: a marquee, an autoplay
 *   plitzi page shot / --clip pricing-table                           # one element, scrolled to wherever it is
 *   plitzi page shot / --scroll-to faq --viewport --frames 6          # the screen at that section, as it animates
 *
 * The project's server has to be running (`npm start`). `--json` answers in one object, for a tool or an agent. The
 * dev tools' badge is never in the picture; a picture of the whole page has every lazy image loaded and shows every
 * arrival that waits for the scroll as it ends — taken without scrolling, they would be holes where the sections are.
 */

export { SHOT_MOMENTS } from './types';
export type { ShotMoment, ShotOptions } from './types';
export { shot, shotEach } from './command';
