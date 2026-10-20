import { closest } from '@plitzi/sdk-authoring';

import { selectorOf } from './click';

import type { Authored } from './space';
import type { CheckIssue, Expectation } from './types';
import type { BrowserPage } from '../../browser';

/**
 * `--expect`: what an element shows, held to the text asked — and a short label broken onto two lines (`label-wraps`).
 */

/** What the first element `selector` names shows, as a visitor reads it — `null` when none is on the page. In the page. */
export const shownTextInPage = (selector: string): string | null => {
  const node = document.querySelector(selector);

  return node instanceof HTMLElement ? node.innerText : node === null ? null : node.textContent;
};

/**
 * The links and buttons whose short label — three words at most — the page breaks onto more than one line: squeezed in
 * a row with no room (a menu one entry too long), which no other check sees. In the page.
 */
export const wrappedLabelsInPage = (selector: string): { id: string; label: string; lines: number }[] =>
  Array.from(document.querySelectorAll(selector)).flatMap(node => {
    const label = node.textContent.replace(/\s+/g, ' ').trim();
    if (label === '' || label.split(' ').length > 3 || !(node instanceof HTMLElement) || node.offsetParent === null) {
      return [];
    }

    // The text's own boxes — never an icon's beside it, which sits at its own height — one per line it runs over.
    const boxes: { top: number; height: number }[] = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      if ((text.textContent ?? '').trim() === '') {
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(text);
      boxes.push(...Array.from(range.getClientRects(), rect => ({ top: rect.top, height: rect.height })));
    }

    // A new line starts more than half a line below the last: boxes of one line differ by less.
    let lines = 0;
    let last = -Infinity;
    for (const box of boxes.sort((a, b) => a.top - b.top)) {
      if (box.top - last > Math.max(box.height, 1) / 2) {
        lines += 1;
        last = box.top;
      }
    }

    return lines > 1 ? [{ id: node.getAttribute('data-plitzi-el') ?? '', label, lines }] : [];
  });

/**
 * What a missing id may have meant, among the page's: the one it starts with — `summary-trend` for `summary-trend-luna`
 * — or the nearest. A list's row has the same ids in every row, so one named per row is never there: said, with how
 * `--expect` reads such an id (its first copy).
 */
export const meantOnPage = (element: string, onPage: readonly string[]): string => {
  const ids = [...new Set(onPage.filter(Boolean))];
  // A page family (or a scope) names its elements by its page: `age-label` is `pet-luna-age-label` on Luna's.
  const scoped = ids.filter(id => id.endsWith(`-${element}`));
  if (scoped.length > 0) {
    return ` — ${scoped.length > 1 ? `one a page: ${scoped.slice(0, 4).join(', ')}${scoped.length > 4 ? '…' : ''}` : `did you mean ${scoped.join('')}?`} (a page family or a scope puts its name before the ids it makes)`;
  }

  const prefix = ids
    .filter(id => element.startsWith(`${id}-`))
    .sort((a, b) => b.length - a.length)
    .at(0);
  const meant = prefix ?? closest(element, ids);
  if (meant === undefined) {
    return '';
  }

  const copies = onPage.filter(id => id === meant).length;

  return copies > 1
    ? ` — ${meant} is, ${String(copies)} times: a list’s row has the same ids in every row, so none is named per row; --expect reads the first`
    : ` — did you mean ${meant}?`;
};

/** Each expectation the page does not meet, as an issue — the element missing, or showing something else — and those it met. */
export const missedExpectations = async (
  page: BrowserPage,
  authored: Authored | undefined,
  expect: readonly Expectation[],
  width: number
): Promise<{ missed: CheckIssue[]; met: string[] }> => {
  const missed: CheckIssue[] = [];
  const met: string[] = [];
  // The ids on the page, each with how many copies it has: what a missing one is told it may have meant.
  const onPage = await page.evaluate(
    (selector: string) =>
      Array.from(document.querySelectorAll(selector), node => node.getAttribute('data-plitzi-el') ?? ''),
    '[data-plitzi-el]'
  );
  for (const { element, text } of expect) {
    const found = await page.evaluate(shownTextInPage, selectorOf(authored, element));
    const shown = found === null ? undefined : found.replace(/\s+/g, ' ').trim();
    if (shown === undefined || !shown.toLowerCase().includes(text.toLowerCase())) {
      missed.push({
        code: 'expected-text',
        message:
          shown === undefined
            ? `--expect ${element}~${text}: no element ${element} is on the page${meantOnPage(element, onPage)}`
            : `--expect ${element}~${text}: ${element} shows "${shown.length > 160 ? `${shown.slice(0, 160)}…` : shown}"`,
        elementId: element,
        width
      });
    } else {
      met.push(`${element}~${text}`);
    }
  }

  return { missed, met };
};
