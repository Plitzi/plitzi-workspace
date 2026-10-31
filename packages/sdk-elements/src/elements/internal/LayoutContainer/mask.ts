const drawsNoBox = (element: Element): boolean => getComputedStyle(element).display === 'contents';

/**
 * The box an element draws on screen: its own — or, for one with `display: contents`, which draws none, the box around
 * what it holds. A shell or a slot that only marks where something goes is written that way, and measured as itself it
 * is a rect of zeros: the hole closes and the whole page is dimmed.
 */
export const boxOf = (element: Element): DOMRect | undefined => {
  if (!drawsNoBox(element)) {
    return element.getBoundingClientRect();
  }

  const boxes = [...element.children]
    .map(boxOf)
    .filter((box): box is DOMRect => box !== undefined && (box.width > 0 || box.height > 0));
  if (boxes.length === 0) {
    return undefined;
  }

  const left = Math.min(...boxes.map(box => box.left));
  const top = Math.min(...boxes.map(box => box.top));

  return new DOMRect(
    left,
    top,
    Math.max(...boxes.map(box => box.right)) - left,
    Math.max(...boxes.map(box => box.bottom)) - top
  );
};

/**
 * The box the mask is drawn in. The mask is the layout's `::before`, placed over its containing block: the layout's own
 * box — or, when the layout draws none, the nearest ancestor that positions what it holds.
 */
export const maskFrameOf = (layout: HTMLElement): HTMLElement => {
  if (!drawsNoBox(layout)) {
    return layout;
  }

  for (let node = layout.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).position !== 'static') {
      return node;
    }
  }

  return layout.ownerDocument.documentElement;
};

/** Which sides of its page a shell draws something on — a header above, a footer below, a sidebar beside. */
export type ChromeSides = { above: boolean; below: boolean; left: boolean; right: boolean };

/**
 * Where the shell draws something around its page — or only leaves room the page's own background fills: the empty end
 * of a shell as tall as the screen, the gutters beside a centred page. Masked, that room read as a grey slab around
 * every page; only what the shell draws is chrome.
 */
export const chromeSides = (layout: HTMLElement, body: Element, page: DOMRect): ChromeSides => {
  const sides: ChromeSides = { above: false, below: false, left: false, right: false };
  for (const node of layout.querySelectorAll('[data-plitzi-el]')) {
    if (node.contains(body) || body.contains(node)) {
      continue;
    }

    const box = node.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) {
      continue;
    }

    // Beside the page is what shares its height; above and below, whatever is past its edge.
    const level = box.top < page.bottom - 1 && box.bottom > page.top + 1;
    sides.above ||= box.top < page.top - 1 && !level;
    sides.below ||= box.bottom > page.bottom + 1 && !level;
    sides.left ||= level && box.left < page.left - 1;
    sides.right ||= level && box.right > page.right + 1;
  }

  return sides;
};
