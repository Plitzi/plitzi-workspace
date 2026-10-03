import { isDrawn } from './dom';

import type { QaFinding } from './dom';

/** Whether something between the element and the page cuts it off at its own edges, so whatever sticks out is unseen. */
const isClipped = (element: Element, page: Element): boolean => {
  const view = element.ownerDocument.defaultView;
  for (let node = element.parentElement; node && node !== page; node = node.parentElement) {
    const overflowX = view?.getComputedStyle(node).overflowX;
    if (overflowX && overflowX !== 'visible') {
      return true;
    }
  }

  return false;
};

/** Everything sticking out past the page's sides — the outermost of each, not all it holds. */
export const findOverflow = (page: Element): QaFinding[] => {
  const bounds = page.getBoundingClientRect();
  const found: QaFinding[] = [];
  for (const element of page.querySelectorAll('*')) {
    if (found.some(finding => finding.element.contains(element)) || !isDrawn(element)) {
      continue;
    }

    const { left, right, width } = element.getBoundingClientRect();
    const past = Math.max(bounds.left - left, right - bounds.right);
    if (width > 0 && past > 1 && !isClipped(element, page)) {
      found.push({ check: 'overflow', element, note: `${String(Math.round(past))} px past the page` });
    }
  }

  return found;
};
