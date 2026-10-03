import type { QaCheck } from './qaSettings';

/**
 * The QA tab's checks: what a tester looks for by hand on every build, looked for at once on the page as it is drawn.
 *
 * - `overflow` — what sticks out past the page's sides: the box that makes a phone scroll sideways.
 * - `names` — a control or a picture a screen reader or a browser agent has no words for.
 * - `targets` — a control smaller than 24 × 24 px with another too close to it (WCAG 2.2 Target Size, Minimum).
 *
 * Each is a heuristic over the live DOM, not an audit: it points at what to look at.
 */

export interface QaFinding {
  check: QaCheck;
  element: Element;
  /** What is wrong with it, in a few words. */
  note: string;
}

/** What can be clicked, typed into or followed. */
const INTERACTIVE =
  'a[href], button, [role="button"], [role="link"], [role="tab"], input:not([type="hidden"]), select, textarea';

/** The smallest a target may be in both directions (WCAG 2.2 Target Size, Minimum). */
export const MIN_TARGET = 24;

const isDrawn = (element: Element): boolean => element.getClientRects().length > 0;

const textOf = (element: Node): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * The words assistive technology finds for an element, by the usual order: what `aria-labelledby` points at, its
 * `aria-label`, a field's `<label>`, the text and the `alt` of the pictures inside it, its `title` — and, last, a
 * field's `placeholder`.
 */
export const accessibleName = (element: Element): string => {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const words = labelledBy
      .split(/\s+/)
      .map(id => element.ownerDocument.getElementById(id))
      .map(target => (target ? textOf(target) : ''))
      .join(' ')
      .trim();
    if (words) {
      return words;
    }
  }

  const label = element.getAttribute('aria-label')?.trim();
  if (label) {
    return label;
  }

  if ('labels' in element && element.labels instanceof NodeList) {
    const words = [...element.labels].map(textOf).join(' ').trim();
    if (words) {
      return words;
    }
  }

  const pictures = [...element.querySelectorAll('img[alt]')].map(image => image.getAttribute('alt') ?? '').join(' ');
  const words = `${textOf(element)} ${pictures}`.trim();
  if (words) {
    return words;
  }

  return element.getAttribute('title')?.trim() ?? element.getAttribute('placeholder')?.trim() ?? '';
};

const describe = (element: Element): string => element.tagName.toLowerCase();

export const findUnnamed = (page: Element): QaFinding[] => [
  ...[...page.querySelectorAll(INTERACTIVE)]
    .filter(element => isDrawn(element) && !accessibleName(element))
    .map((element): QaFinding => ({ check: 'names', element, note: `a ${describe(element)} with no name` })),
  // An empty `alt` says "decorative", which is a name of a kind; no `alt` at all is the omission.
  ...[...page.querySelectorAll('img:not([alt])')]
    .filter(isDrawn)
    .map((element): QaFinding => ({ check: 'names', element, note: 'a picture with no alt' }))
];

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

export const SCANS: Record<QaCheck, (page: Element) => QaFinding[]> = {
  overflow: findOverflow,
  names: findUnnamed,
  targets: findSmallTargets
};
