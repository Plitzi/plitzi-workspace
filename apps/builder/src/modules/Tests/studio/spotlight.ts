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

/** The element lit in each canvas, followed while it is lit. */
const lit = new WeakMap<Document, Element>();

/** Whether an element takes room on the page: one hidden has nothing to ring — a ring round its empty box sits in a corner. */
const shown = (node: Element): boolean => {
  const box = node.getBoundingClientRect();

  return box.width > 0 && box.height > 0 && node.checkVisibility({ visibilityProperty: true });
};

const place = (ring: HTMLElement, node: Element): void => {
  const box = node.getBoundingClientRect();
  Object.assign(ring.style, {
    top: `${String(box.top - 4)}px`,
    left: `${String(box.left - 4)}px`,
    width: `${String(box.width + 8)}px`,
    height: `${String(box.height + 8)}px`
  });
};

/** What keeps a canvas' ring on its element: everything that can move it, watched while one is lit and dropped after. */
type Follower = { stop: () => void; watch: (node: Element) => void };

const followers = new WeakMap<Document, Follower>();

/**
 * The ring on its element, or gone with it: put back where the element is now, or cleared once it left the page or
 * stopped being drawn — a play that moves to another page takes the element away, and a ring left where it was rings
 * whatever the new page drew there.
 */
const refresh = (document: Document): void => {
  const node = lit.get(document);
  const ring = document.querySelector<HTMLElement>(`[${MARK}]`);
  if (!node || !ring) {
    return;
  }

  if (!node.isConnected || !shown(node)) {
    clearSpotlight(document);

    return;
  }

  // Stuck to it while it moves; the next step's ring glides again.
  ring.style.transition = 'none';
  place(ring, node);
};

/**
 * Follows the lit element through anything that moves it: the page scrolling — the play's own scrolling, or the
 * person's — the canvas resizing, the element resizing, and the page changing under it, a navigation above all. Once a
 * frame at most, however much changed in it.
 */
const follow = (document: Document, node: Element): void => {
  const view = document.defaultView;
  if (!view) {
    return;
  }

  const kept = followers.get(document);
  if (kept) {
    kept.watch(node);

    return;
  }

  let frame = 0;
  const schedule = () => {
    if (frame === 0) {
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        refresh(document);
      });
    }
  };
  // The ring's own moves are changes to the page too: left in, every placing would ask for the next.
  const changes = new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof view.HTMLElement && record.target.hasAttribute(MARK)))) {
      schedule();
    }
  });
  changes.observe(document.body, { childList: true, subtree: true, attributes: true });
  const sizes = new view.ResizeObserver(schedule);
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  view.addEventListener('resize', schedule);
  const follower: Follower = {
    watch: next => {
      sizes.disconnect();
      sizes.observe(next);
    },
    stop: () => {
      view.cancelAnimationFrame(frame);
      changes.disconnect();
      sizes.disconnect();
      document.removeEventListener('scroll', schedule, { capture: true });
      view.removeEventListener('resize', schedule);
    }
  };
  follower.watch(node);
  followers.set(document, follower);
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

  if (!shown(node)) {
    clearSpotlight(document);

    return;
  }

  lit.set(document, node);
  follow(document, node);
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
    followers.get(document)?.stop();
    followers.delete(document);
    document.querySelector(`[${MARK}]`)?.remove();
  }
};
