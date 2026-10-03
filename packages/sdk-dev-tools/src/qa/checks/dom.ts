import type { QaCheck } from '../qaSettings';

export interface QaFinding {
  check: QaCheck;
  element: Element;
  /** What is wrong with it, in a few words. */
  note: string;
}

/** What can be clicked, typed into or followed. */
export const INTERACTIVE =
  'a[href], button, [role="button"], [role="link"], [role="tab"], input:not([type="hidden"]), select, textarea';

/** Whether the element takes any room on the screen at all. */
export const isDrawn = (element: Element): boolean => element.getClientRects().length > 0;

/** Text as it reads: every run of white space one space. */
export const textOf = (node: Node): string => (node.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The words the element itself holds, not its children's — the line of text that is this element's own. */
export const ownTextOf = (element: Element): string =>
  [...element.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(textOf)
    .join(' ')
    .trim();
