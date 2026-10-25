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

/** Whether the first element `selector` names is drawn: on the page, and with a box of its own. In the page. */
export const isShownInPage = (selector: string): boolean => {
  const node = document.querySelector(selector);

  return node !== null && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
};

/**
 * The links and buttons whose short label — three words at most — the page breaks onto more than one line: squeezed in
 * a row with no room (a menu one entry too long), which no other check sees. In the page.
 */
export const wrappedLabelsInPage = (selector: string): { id: string; label: string; lines: number }[] =>
  Array.from(document.querySelectorAll(selector)).flatMap(node => {
    if (!(node instanceof HTMLElement) || node.offsetParent === null) {
      return [];
    }

    // The text's own boxes — never an icon's beside it, which sits at its own height — grouped by the block each runs
    // in: a card whose eyebrow and title are two blocks, stacked on purpose ("Artista anterior" over "Juanes"), is two
    // lines of one each, not a label broken in two. Only a block whose own text runs over lines is a squeezed label.
    const blockOf = (text: Node): Element => {
      for (let at = text.parentElement; at && at !== node; at = at.parentElement) {
        if (!getComputedStyle(at).display.startsWith('inline')) {
          return at;
        }
      }

      return node;
    };
    const groups = new Map<Element, { words: string[]; boxes: { top: number; height: number }[] }>();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      const words = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (words === '') {
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(text);
      const block = blockOf(text);
      const group = groups.get(block) ?? { words: [], boxes: [] };
      group.words.push(words);
      group.boxes.push(...Array.from(range.getClientRects(), rect => ({ top: rect.top, height: rect.height })));
      groups.set(block, group);
    }

    // The label as it reads, each block's words apart: `textContent` ran a tile's "TARJETAS GRÁFICAS" into its
    // "Compra ahora" as "GRÁFICASCompra" — three words of a four-word link, a label it never was.
    const label = [...groups.values()].map(group => group.words.join(' ')).join(' ');
    if (label === '' || label.split(' ').length > 3) {
      return [];
    }

    // A new line starts more than half a line below the last: boxes of one line differ by less.
    const linesOf = (boxes: { top: number; height: number }[]): number => {
      let count = 0;
      let last = -Infinity;
      for (const box of boxes.sort((a, b) => a.top - b.top)) {
        if (box.top - last > Math.max(box.height, 1) / 2) {
          count += 1;
          last = box.top;
        }
      }

      return count;
    };
    // The block that runs over the most lines is the label said: the words the original's wrapping is compared with.
    const [wrapped] = [...groups.values()]
      .map(group => ({ text: group.words.join(' '), lines: linesOf(group.boxes) }))
      .sort((a, b) => b.lines - a.lines);

    return wrapped.lines > 1
      ? [{ id: node.getAttribute('data-plitzi-el') ?? '', label: wrapped.text, lines: wrapped.lines }]
      : [];
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
    if (text === '') {
      if (await page.evaluate(isShownInPage, selectorOf(authored, element))) {
        met.push(element);
      } else {
        missed.push({
          code: 'expected-text',
          message: `--expect ${element}: ${element} is not shown on the page${meantOnPage(element, onPage)}`,
          elementId: element,
          width
        });
      }

      continue;
    }

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

/**
 * Run in the page: each link or button drawn on its section's bottom edge — within a pixel of it — where that section
 * keeps no space below its content (padding-bottom 0): what sat against the next section with nothing between them.
 * Carlos saw a run's "Ver cartelera completa" on #combates' edge, and no check, look or comparison had said it:
 * the home's sections shared a class with no bottom padding. Self-contained — it is sent to the browser as it is.
 */
export const flushEdgesInPage = (): { id: string; section: string }[] => {
  // Said once an element, of the innermost section it sits on — a section inside another comes later in the document.
  const found = new Map<string, { id: string; section: string }>();
  for (const each of Array.from(document.querySelectorAll('section[data-plitzi-el]')).flatMap(section => {
    const box = section.getBoundingClientRect();
    if (box.height < 40 || Number.parseFloat(getComputedStyle(section).paddingBottom) > 0) {
      return [];
    }

    return Array.from(section.querySelectorAll('a[data-plitzi-el], button[data-plitzi-el]')).flatMap(node => {
      const own = node.getBoundingClientRect();
      const shown = own.width >= 2 && own.height >= 2 && getComputedStyle(node).visibility !== 'hidden';

      return shown && Math.abs(box.bottom - own.bottom) <= 1
        ? [{ id: node.getAttribute('data-plitzi-el') ?? '', section: section.getAttribute('data-plitzi-el') ?? '' }]
        : [];
    });
  })) {
    found.set(each.id, each);
  }

  return [...found.values()];
};
