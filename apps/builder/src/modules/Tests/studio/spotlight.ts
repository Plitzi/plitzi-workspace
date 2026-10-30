import { reveal } from './reveal';

/**
 * What a step of a test is about, lit in the canvas while it is played: a ring around its element — the builder's
 * violet for something done, green for something checked, red when it failed — drawn over the page, taking no press.
 */

export type SpotlightTone = 'act' | 'check' | 'failed';

const MARK = 'data-plitzi-test-spotlight';

const TONES: Record<SpotlightTone, { ring: string; glow: string }> = {
  act: { ring: '#7c5cff', glow: 'rgba(124, 92, 255, 0.25)' },
  check: { ring: '#10b981', glow: 'rgba(16, 185, 129, 0.25)' },
  failed: { ring: '#ef4444', glow: 'rgba(239, 68, 68, 0.25)' }
};

/** The element a target names — `row`, `row:3`, `row:last` — in the canvas. */
export const canvasElementOf = (document: Document, target: string): Element | undefined => {
  const copy = /^(.+):(\d+|last)$/.exec(target);
  const all = [...document.querySelectorAll(`[data-plitzi-el="${CSS.escape(copy ? copy[1] : target)}"]`)];
  if (!copy) {
    return all.at(0);
  }

  return copy[2] === 'last' ? all.at(-1) : all.at(Number(copy[2]) - 1);
};

const MOVE = 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease, opacity 0.2s ease';

const ringOf = (document: Document): HTMLElement => {
  const kept = document.querySelector<HTMLElement>(`[${MARK}]`);
  if (kept) {
    return kept;
  }

  const ring = document.createElement('div');
  ring.setAttribute(MARK, '');
  Object.assign(ring.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483647',
    borderRadius: '6px',
    transition: MOVE
  });
  document.body.append(ring);

  return ring;
};

/** The element lit in each canvas, followed as the page scrolls under it. */
const lit = new WeakMap<Document, Element>();

/** The canvases whose scrolling is already listened to: one listener each, however often a ring comes and goes. */
const followed = new WeakSet<Document>();

const place = (ring: HTMLElement, node: Element): void => {
  const box = node.getBoundingClientRect();
  Object.assign(ring.style, {
    top: `${String(box.top - 4)}px`,
    left: `${String(box.left - 4)}px`,
    width: `${String(box.width + 8)}px`,
    height: `${String(box.height + 8)}px`
  });
};

/** The ring kept on its element while anything in the page scrolls — the play's own scrolling, or the person's. */
const follow = (document: Document): void => {
  if (followed.has(document)) {
    return;
  }

  followed.add(document);
  document.addEventListener(
    'scroll',
    () => {
      const node = lit.get(document);
      const ring = document.querySelector<HTMLElement>(`[${MARK}]`);
      if (node && ring) {
        // Stuck to it while it moves; the next step's ring glides again.
        ring.style.transition = 'none';
        place(ring, node);
      }
    },
    { capture: true, passive: true }
  );
};

/**
 * Lights the element a step names, and brings it into view; nothing to light — a step with no element, or one not on
 * the page — clears it.
 */
export const spotlight = (document: Document | null | undefined, target: string | undefined, tone: SpotlightTone) => {
  if (!document) {
    return;
  }

  const node = target === undefined ? undefined : canvasElementOf(document, target);
  if (!node) {
    clearSpotlight(document);

    return;
  }

  // An element hidden takes no room on the page: there is nothing to ring — a ring round its empty box sits in the
  // page's corner.
  const shown = node.getBoundingClientRect();
  if (shown.width === 0 || shown.height === 0 || !node.checkVisibility({ visibilityProperty: true })) {
    clearSpotlight(document);

    return;
  }

  follow(document);
  lit.set(document, node);
  const ring = ringOf(document);
  const { ring: color, glow } = TONES[tone];
  Object.assign(ring.style, {
    transition: MOVE,
    border: `2px solid ${color}`,
    boxShadow: `0 0 0 4px ${glow}`,
    opacity: '1'
  });
  place(ring, node);
  reveal(node);
};

export const clearSpotlight = (document: Document | null | undefined): void => {
  if (document) {
    lit.delete(document);
    document.querySelector(`[${MARK}]`)?.remove();
  }
};
