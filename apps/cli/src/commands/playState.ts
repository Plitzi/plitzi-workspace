import { targetOn } from './shot/capture';

import type { BrowserPage } from '../browser';

/**
 * An element of a page as `page play` reads it after each step — read in the page, where nothing of the module is — and
 * found there by any name first.
 */

/** The ARIA states a control says of itself — what a toggle, a disclosure or a tab is at. */
export const ARIA_STATES = ['pressed', 'expanded', 'checked', 'selected'] as const;

/**
 * An element as a step leaves it: where its content is, whether it is seen, whether it takes a press — and what a
 * control says: its words, a field's value, its ARIA states, whether it holds the focus. Four agents wrote a
 * Playwright script for what this did not read — Listen turning Mute, the focus back on the burger, a search typed.
 */
export interface ElementState {
  /** Its content's offset — scroll less place — in whole pixels: what a move changes, however it is made. */
  offset: { x: number; y: number };
  shown: boolean;
  /**
   * Hidden for screen readers alone — the `sr-only` pattern, a box of a pixel clipped to nothing — never shown: a spike
   * read a stack's "1 listening" as a second count on screen.
   */
  screenReaderOnly?: true;
  enabled: boolean;
  /**
   * Its words, as a visitor reads them — none of a part hidden or for screen readers alone: whitespace folded, the first
   * 80 characters. A list's read whole held its rows' hidden "Added by ↓".
   */
  text: string;
  /** How many rows a list in it shows — the first level with two or more siblings named alike. */
  rows?: number;
  /** A field's value: an input, a textarea, a select. */
  value?: string;
  /** The ARIA states it says, each as its attribute (or a box's own `checked`) is. */
  aria: Partial<Record<(typeof ARIA_STATES)[number], string>>;
  /** It holds the focus, or something inside it does. */
  focused: boolean;
  /**
   * Where it is against the viewport — and, in it, what covers its middle (a sticky header): a `scrollIntoView` that
   * left a heading under the header read as fine (a run's dev-1 and design-1).
   */
  inView: 'whole' | 'part' | 'out';
  coveredBy?: string;
  /** Its transform, when it has one, as scale and translate: a bump (scale) or a float read as nothing moving. */
  transform?: string;
  /**
   * Its text's colour and the ground it sits on — its own, else the first an ancestor paints: a run's tone picker
   * was proven by ten page measures, one a tone and scheme, the play saying nothing of colour.
   */
  colour: { text: string; ground: string };
  /**
   * Its animations as they stand — `float finished` — when it has any: a run's reaction floated in and out, and a
   * read after it said "hidden", as though the press had done nothing.
   */
  animations?: string[];
}

/** Run in the page, on the element: where its content is, whether it is seen, whether it takes a press. */
export const stateOf = (node: Element): ElementState => {
  // Everything here runs in the page, where nothing of this module is: its helpers are its own.
  const placeOf = (element: Element, rect: DOMRect): Pick<ElementState, 'inView' | 'coveredBy'> => {
    const inside = (from: number, to: number, size: number) => from >= 0 && to <= size;
    const touches = (from: number, to: number, size: number) => to > 0 && from < size;
    const inView =
      inside(rect.top, rect.bottom, innerHeight) && inside(rect.left, rect.right, innerWidth)
        ? ('whole' as const)
        : touches(rect.top, rect.bottom, innerHeight) && touches(rect.left, rect.right, innerWidth)
          ? ('part' as const)
          : ('out' as const);
    if (inView === 'out' || rect.width === 0 || rect.height === 0) {
      return { inView };
    }

    const middle = {
      x: Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1),
      y: Math.min(Math.max(rect.top + Math.min(rect.height / 2, 12), 0), innerHeight - 1)
    };
    const hit = document.elementFromPoint(middle.x, middle.y);
    if (!hit || element.contains(hit) || hit.contains(element)) {
      return { inView };
    }

    const named = hit.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el');

    return { inView, coveredBy: named ?? hit.tagName.toLowerCase() };
  };
  const transformOf = (value: string): string | undefined => {
    const matrix = /^matrix\(([^)]+)\)$/.exec(value);
    if (!matrix) {
      return undefined;
    }

    const [a = 1, b = 0, , , e = 0, f = 0] = matrix[1].split(',').map(Number);
    const scale = Math.round(Math.hypot(a, b) * 100) / 100;
    const said = [
      ...(scale === 1 ? [] : [`scale ${String(scale)}`]),
      ...(Math.round(e) === 0 && Math.round(f) === 0
        ? []
        : [`translate ${String(Math.round(e))},${String(Math.round(f))}`])
    ];

    return said.length > 0 ? said.join(', ') : undefined;
  };
  // The ground its text sits on: its own colour, else the first an ancestor paints — white where none does.
  const groundOf = (element: Element): string => {
    for (let at: Element | null = element; at; at = at.parentElement) {
      const ground = getComputedStyle(at).backgroundColor;
      if (ground !== 'rgba(0, 0, 0, 0)' && ground !== 'transparent') {
        return ground;
      }
    }

    return 'rgb(255, 255, 255)';
  };
  // The `sr-only` pattern: clipped all over, or a box of a pixel that clips what overflows it.
  const forScreenReaders = (element: Element): boolean => {
    const own = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      /inset\(\s*50%/.test(own.clipPath) ||
      /^rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)$/.test(own.clip) ||
      (rect.width <= 1 && rect.height <= 1 && /hidden|clip/.test(`${own.overflowX} ${own.overflowY}`))
    );
  };
  const unseen = (element: Element): boolean =>
    element.hasAttribute('hidden') || getComputedStyle(element).display === 'none' || forScreenReaders(element);
  const seenText = (element: Element): string =>
    [...element.childNodes]
      .map(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          return getComputedStyle(element).visibility === 'hidden' ? '' : (child.textContent ?? '');
        }

        if (!(child instanceof Element) || unseen(child)) {
          return '';
        }

        // A block's words are a line of their own: never run into the next block's.
        return getComputedStyle(child).display.startsWith('inline') ? seenText(child) : ` ${seenText(child)} `;
      })
      .join('');
  // The shallowest level of it where two or more siblings shown are named alike: a list's rows, not a row's tags.
  const rowsOf = (element: Element): number | undefined => {
    for (let level: Element[] = [element]; level.length > 0; level = level.flatMap(each => [...each.children])) {
      for (const parent of level) {
        const counts = new Map<string, number>();
        for (const child of parent.children) {
          const name = child.getAttribute('data-plitzi-el');
          if (name !== null && !unseen(child)) {
            counts.set(name, (counts.get(name) ?? 0) + 1);
          }
        }

        const most = Math.max(0, ...counts.values());
        if (most >= 2) {
          return most;
        }
      }
    }

    return undefined;
  };
  let screenReaderOnly = false;
  for (let at: Element | null = node; at && !screenReaderOnly; at = at.parentElement) {
    screenReaderOnly = forScreenReaders(at);
  }

  const box = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  const rows = rowsOf(node);
  const disabled =
    node.matches(':disabled, [aria-disabled="true"]') ||
    style.pointerEvents === 'none' ||
    node.closest('[inert]') !== null;
  // A part whose own box never scrolls but holds the row that does — a carousel named by its track, its scroller
  // inside (a run's dev-1 read `.carousel__scroller` by its class): that row's scroll is what moved.
  const scrolls = (each: Element): boolean => {
    const overflow = getComputedStyle(each);

    return (
      (each.scrollWidth > each.clientWidth && /auto|scroll/.test(overflow.overflowX)) ||
      (each.scrollHeight > each.clientHeight && /auto|scroll/.test(overflow.overflowY))
    );
  };
  const inner = scrolls(node) ? [] : [...node.querySelectorAll('*')].filter(scrolls);
  const scroller = inner.length === 1 ? inner[0] : node;

  return {
    offset: {
      x: Math.round(scroller.scrollLeft - box.left),
      y: Math.round(scroller.scrollTop - box.top - window.scrollY)
    },
    ...placeOf(node, box),
    ...(transformOf(style.transform) ? { transform: transformOf(style.transform) } : {}),
    shown:
      !screenReaderOnly &&
      box.width > 0 &&
      box.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0,
    ...(screenReaderOnly ? { screenReaderOnly: true as const } : {}),
    enabled: !disabled,
    text: seenText(node).replace(/\s+/g, ' ').trim().slice(0, 80),
    ...(rows === undefined ? {} : { rows }),
    ...(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement
      ? { value: node.value }
      : {}),
    // The list inline: this runs in the page, where nothing of the module is.
    aria: Object.fromEntries(
      (['pressed', 'expanded', 'checked', 'selected'] as const).flatMap(state => {
        const said = node.getAttribute(`aria-${state}`);
        const own = state === 'checked' && node instanceof HTMLInputElement && /checkbox|radio/.test(node.type);

        return said !== null ? [[state, said]] : own ? [[state, String(node.checked)]] : [];
      })
    ),
    focused:
      document.activeElement !== null && (node === document.activeElement || node.contains(document.activeElement)),
    colour: { text: style.color, ground: groundOf(node) },
    ...(node.getAnimations().length > 0
      ? {
          animations: node
            .getAnimations()
            .map(
              animation =>
                `${animation instanceof CSSAnimation ? animation.animationName : animation instanceof CSSTransition ? `${animation.transitionProperty} transition` : 'animation'} ${animation.playState}`
            )
        }
      : {})
  };
};

/**
 * One element's state on a page, by the way every page command names one — a Playwright selector too
 * (`:has-text("…")`): the first of it shown, else the first.
 */
export const readState = async (page: BrowserPage, target: string): Promise<ElementState | { problem: string }> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  if (!found.found) {
    return { problem: `${target} is not on ${page.url()}` };
  }

  const located = page.locator(found.selector);
  const visible = located.filter({ visible: true }).first();

  return ((await visible.count()) > 0 ? visible : located.first()).evaluate(stateOf, undefined);
};
