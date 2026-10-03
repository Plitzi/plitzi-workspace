import { INTERACTIVE, isDrawn, textOf } from './dom';

import type { QaFinding } from './dom';

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

/** A control or a picture a screen reader or a browser agent has no words for. */
export const findUnnamed = (page: Element): QaFinding[] => [
  ...[...page.querySelectorAll(INTERACTIVE)]
    .filter(element => isDrawn(element) && !accessibleName(element))
    .map((element): QaFinding => ({
      check: 'names',
      element,
      note: `a ${element.tagName.toLowerCase()} with no name`
    })),
  // An empty `alt` says "decorative", which is a name of a kind; no `alt` at all is the omission.
  ...[...page.querySelectorAll('img:not([alt])')]
    .filter(isDrawn)
    .map((element): QaFinding => ({ check: 'names', element, note: 'a picture with no alt' }))
];
