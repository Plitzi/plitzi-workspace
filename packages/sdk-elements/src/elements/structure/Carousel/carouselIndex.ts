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

/** How far one slide is from the next in a scrolling row: its width and the gap after it. */
export const slideStep = (scroller: HTMLElement): number => {
  const slide = scroller.firstElementChild;
  if (!(slide instanceof HTMLElement)) {
    return 0;
  }

  const gap = Number.parseFloat(getComputedStyle(scroller).columnGap);

  return slide.offsetWidth + (Number.isFinite(gap) ? gap : 0);
};
