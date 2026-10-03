import { INTERACTIVE, isDrawn } from './dom';

import type { QaFinding } from './dom';

/** The smallest a target may be in both directions (WCAG 2.2 Target Size, Minimum). */
export const MIN_TARGET = 24;

/** How far a point is from a box — zero inside it. */
const distanceTo = (x: number, y: number, box: DOMRect): number =>
  Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));

/**
 * Controls smaller than 24 × 24 px that also fail the rule's spacing exception: a small target passes when a 24 px
 * circle centred on it touches no other target, which is what keeps a column of footer links apart.
 */
export const findSmallTargets = (page: Element): QaFinding[] => {
  const view = page.ownerDocument.defaultView;
  // A link inside a line of text is exempt: it is as tall as the words around it.
  const targets = [...page.querySelectorAll(INTERACTIVE)].filter(
    element => isDrawn(element) && view?.getComputedStyle(element).display !== 'inline'
  );
  const boxes = targets.map(element => element.getBoundingClientRect());

  return targets.flatMap((element, index): QaFinding[] => {
    const box = boxes[index];
    if (box.width >= MIN_TARGET && box.height >= MIN_TARGET) {
      return [];
    }

    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const crowded = boxes.some(
      (other, otherIndex) =>
        otherIndex !== index && !element.contains(targets[otherIndex]) && distanceTo(x, y, other) < MIN_TARGET / 2
    );
    if (!crowded) {
      return [];
    }

    return [
      {
        check: 'targets',
        element,
        note: `${String(Math.round(box.width))} × ${String(Math.round(box.height))} px, crowded`
      }
    ];
  });
};
