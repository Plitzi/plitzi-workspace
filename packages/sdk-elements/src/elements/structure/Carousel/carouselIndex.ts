/** Which way the carousel last moved: what a slide entering animates from. */
export type CarouselDirection = 'next' | 'previous';

/**
 * Where a move lands: `delta` slides on, round the ends when the carousel loops and stopped at them when it does not.
 * An empty carousel stays at 0.
 */
export const stepIndex = (index: number, count: number, delta: number, loop: boolean): number => {
  if (count <= 0) {
    return 0;
  }

  const target = index + delta;
  if (loop) {
    return ((target % count) + count) % count;
  }

  return Math.min(count - 1, Math.max(0, target));
};

/** A requested position, as one the carousel has: whole, and within its slides. */
export const clampIndex = (index: unknown, count: number): number => {
  const asNumber = typeof index === 'number' ? index : Number(index);
  if (!Number.isFinite(asNumber) || count <= 0) {
    return 0;
  }

  return Math.min(count - 1, Math.max(0, Math.trunc(asNumber)));
};

/** The way a jump goes: on to a later slide, back to an earlier one. */
export const directionOf = (from: number, to: number): CarouselDirection => (to < from ? 'previous' : 'next');

/** The gap between two slides of a scrolling row, in pixels. */
const gapOf = (scroller: HTMLElement): number => {
  const gap = Number.parseFloat(getComputedStyle(scroller).columnGap);

  return Number.isFinite(gap) ? gap : 0;
};

/** How far one slide is from the next in a scrolling row: its width and the gap after it. */
export const slideStep = (scroller: HTMLElement): number => {
  const slide = scroller.firstElementChild;
  if (!(slide instanceof HTMLElement)) {
    return 0;
  }

  return slide.offsetWidth + gapOf(scroller);
};

/** How far a press moves: one slide, or a page — as many slides as the row shows whole. */
export type CarouselStep = 'slide' | 'page';

/** A step a flow wrote, as one the carousel takes: a page when it says so, a slide otherwise. */
export const stepOf = (by: unknown): CarouselStep => (by === 'page' ? 'page' : 'slide');

/**
 * Where a carousel stands: at its first slide, at its last — a scrolling row at either end of its box, however many
 * slides it shows (several in view, its index never reaches the last) — and how many slides it shows whole.
 */
export type CarouselEdges = { atStart: boolean; atEnd: boolean; shown: number };

/** A scrolling row's edges, read off its box: a pixel of rounding either way is an end reached. */
export const rowEdges = (scroller: HTMLElement): CarouselEdges => {
  const step = slideStep(scroller);
  const left = scroller.scrollLeft;

  return {
    atStart: left <= 1,
    atEnd: left + scroller.clientWidth >= scroller.scrollWidth - 1,
    shown: step > 0 ? Math.max(1, Math.floor((scroller.clientWidth + gapOf(scroller) + 1) / step)) : 1
  };
};

/** A carousel of one slide at a time: at an end only where it stops there, never round one when it loops. */
export const slideEdges = (index: number, count: number, loop: boolean): CarouselEdges => ({
  atStart: !loop && index <= 0,
  atEnd: !loop && index >= count - 1,
  shown: 1
});
