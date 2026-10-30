/**
 * An element of the canvas brought into view — the one a step is about, so what happens to it is seen.
 *
 * Not `scrollIntoView`: from inside the canvas' iframe it scrolls the editor around it too, and the Tests area would
 * shift under the person's eyes. Only what scrolls inside the page moves: the element's nearest scroller, else the
 * page, and only when the element is not already well in view — then it is centred.
 */

/** How close to an edge an element may sit and still count as in view, in px. */
const MARGIN = 24;

const scrollerOf = (node: Element): Element | undefined => {
  const view = node.ownerDocument.defaultView;
  for (let at = node.parentElement; at; at = at.parentElement) {
    const overflow = view?.getComputedStyle(at).overflowY ?? '';
    if (/(auto|scroll|overlay)/.test(overflow) && at.scrollHeight > at.clientHeight) {
      return at;
    }
  }

  return undefined;
};

export const reveal = (node: Element, behavior: ScrollBehavior = 'smooth'): void => {
  const document = node.ownerDocument;
  const scroller = scrollerOf(node);
  const page = document.scrollingElement;
  const frame = scroller
    ? scroller.getBoundingClientRect()
    : { top: 0, height: document.defaultView?.innerHeight ?? document.documentElement.clientHeight };
  const box = node.getBoundingClientRect();
  const inView = box.top >= frame.top + MARGIN && box.bottom <= frame.top + frame.height - MARGIN;
  if (inView) {
    return;
  }

  // Centred — or, for one taller than what shows it, its top in view.
  const by =
    box.height > frame.height ? box.top - frame.top - MARGIN : box.top - frame.top - (frame.height - box.height) / 2;
  (scroller ?? page)?.scrollBy({ top: by, behavior });
};
