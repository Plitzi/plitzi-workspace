/**
 * What the scroll steps and the `onScroll` trigger read and write, as plain arithmetic over a box's sizes — so the
 * meaning of `'80%'` or `'end'` is decided once, and tested without a browser.
 */

/** A box that scrolls, measured: what `Element` has, and all these functions read. */
export type ScrollBox = {
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
};

/** What `onScroll` hands its flow: where the box is, and whether it is at either end of the way it scrolls. */
export type ScrollTriggerPayload = { x: number; y: number; atStart: boolean; atEnd: boolean };

export const SCROLL_BEHAVIORS = ['smooth', 'auto'] as const;

export type ScrollStepBehavior = (typeof SCROLL_BEHAVIORS)[number];

/** Where `scrollIntoView` lands an element, on each axis. */
export const SCROLL_POSITIONS = ['start', 'center', 'end', 'nearest'] as const;

export type ScrollStepPosition = (typeof SCROLL_POSITIONS)[number];

/** A box within a pixel of an end is at it: fractional scroll offsets never land exactly on one. */
const EDGE_TOLERANCE = 1;

const LENGTH = /^(-?\d+(?:\.\d+)?)(px|%)?$/;

/**
 * A distance to move: pixels (`240`, `'240'`, `'240px'`) or a share of what the box shows (`'80%'` of its width) —
 * negative goes back. `undefined` for nothing to move, or for text that is not a length.
 */
export const scrollDistance = (value: unknown, visible: number): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const match = LENGTH.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);

  return match[2] === '%' ? (amount / 100) * visible : amount;
};

/**
 * A place to go to on one axis: `'start'`, `'end'`, pixels from the start, or a share of the whole way (`'50%'` is
 * half-way). `undefined` leaves that axis where it is.
 */
export const scrollPosition = (value: unknown, scrollSize: number, clientSize: number): number | undefined => {
  const range = Math.max(scrollSize - clientSize, 0);
  if (value === 'start') {
    return 0;
  }

  if (value === 'end') {
    return range;
  }

  const position = scrollDistance(value, range);

  return position === undefined ? undefined : Math.min(Math.max(position, 0), range);
};

/**
 * Where a box is, for `onScroll`. The ends are those of the way it scrolls — across for a row wider than its box,
 * down otherwise — which is what an arrow that hides at the end of a carousel asks.
 */
export const scrollState = (box: ScrollBox): ScrollTriggerPayload => {
  const across = box.scrollWidth - box.clientWidth > EDGE_TOLERANCE;
  const position = across ? box.scrollLeft : box.scrollTop;
  const range = across ? box.scrollWidth - box.clientWidth : box.scrollHeight - box.clientHeight;

  return {
    x: Math.round(box.scrollLeft),
    y: Math.round(box.scrollTop),
    atStart: position <= EDGE_TOLERANCE,
    atEnd: position >= range - EDGE_TOLERANCE
  };
};

/** The trigger a scroll fires, its action name in a flow. */
export const SCROLL_TRIGGER = 'onScroll';
