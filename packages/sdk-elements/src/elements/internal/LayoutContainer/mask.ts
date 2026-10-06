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
