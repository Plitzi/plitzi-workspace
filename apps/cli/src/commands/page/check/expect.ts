import { closest } from '@plitzi/sdk-authoring';
import { sightOf, sightText } from '@plitzi/sdk-shared/devTools';

import { selectorOf } from './click';

import type { Authored } from './space';
import type { CheckIssue, Expectation } from './types';
import type { BrowserPage } from '../../../browser';
import type { Sight } from '@plitzi/sdk-shared/devTools';

/**
 * `--expect`: what an element shows, held to the text asked — and a short label broken onto two lines (`label-wraps`).
 */

/** The copies of one element on the page: how many there are, and what each one drawn shows. */
export interface Copies {
  present: number;
  /** Each copy drawn — on the page, with a box of its own — by what it shows, whitespace folded. */
  shown: string[];
  /** Of them, by their place in `shown`, those whose text runs past a box that cuts it: a visitor reads them cut short. */
  cut: number[];
  /** Of them, by their place in `shown`, those a visitor sees only once a box is scrolled: that box, by name. */
  scrolled?: Record<number, string>;
  /** Copies drawn that no visitor sees — clipped, under another element: what each shows, and what keeps it unseen. */
  unseen?: { text: string; why: string }[];
}

/** One element drawn: its id, what it shows, whether its text runs past a box that cuts it, its place in the page. */
export interface DrawnText {
  id: string;
  text: string;
  cut: boolean;
  /** Its place among the elements the selector finds, in the page's order: what its sight is read by. */
  index: number;
}

/**
 * The elements `selector` names, as a visitor reads them: how many are on the page, and each one drawn — its words, and
 * whether a box cuts them (an ellipsis, a clipped overflow, a clamp of lines): its words are all in the page, and a
 * visitor reads part of them ("ROOFTOP SESSIO…" passed every check a run made). `within`: a box inside it cutting its
 * text cuts it too — what an element shows; without, only its own — which one is cut. In the page.
 */
export const textsInPage = ({
  selector,
  within
}: {
  selector: string;
  within: boolean;
}): {
  present: number;
  drawn: DrawnText[];
} => {
  const nodes = Array.from(document.querySelectorAll(selector));
  // The `sr-only` pattern: clipped all over, or a box of a pixel that clips what overflows it — words a screen reader
  // hears whole and no visitor sees, never cut (a run's ON AIR lamp's "Not on air yet" read "cut short" in every look).
  const forScreenReaders = (element: Element): boolean => {
    const own = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      /inset\(\s*50%/.test(own.clipPath) ||
      /^rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)$/.test(own.clip) ||
      (rect.width <= 1 && rect.height <= 1 && /hidden|clip/.test(`${own.overflowX} ${own.overflowY}`))
    );
  };
  const cuts = (each: Element): boolean => {
    if (!(each instanceof HTMLElement) || each.getClientRects().length === 0 || forScreenReaders(each)) {
      return false;
    }

    const words = Array.from(each.childNodes).filter(
      child => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== ''
    );
    const style = getComputedStyle(each);
    const clamp = style.getPropertyValue('-webkit-line-clamp');
    const across = style.textOverflow === 'ellipsis' || ['hidden', 'clip'].includes(style.overflowX);
    const clamped = clamp !== '' && clamp !== 'none';
    if (words.length === 0 || (!across && !clamped)) {
      return false;
    }

    // The words as laid out, against the box's content: its scroll widened by a pseudo-element's hairline is no word
    // cut — a run's titles read "cut short", their text whole beside an ::after the box clips.
    const range = document.createRange();
    range.setStartBefore(words[0]);
    range.setEndAfter(words[words.length - 1]);
    const laid = range.getBoundingClientRect();
    const box = each.getBoundingClientRect();
    const px = (value: string): number => Number.parseFloat(value) || 0;
    const left = box.left + px(style.borderLeftWidth) + px(style.paddingLeft);
    const right = box.right - px(style.borderRightWidth) - px(style.paddingRight);
    const bottom = box.bottom - px(style.borderBottomWidth) - px(style.paddingBottom);

    return (across && (laid.right > right + 1 || laid.left < left - 1)) || (clamped && laid.bottom > bottom + 1);
  };

  return {
    present: nodes.length,
    drawn: nodes.flatMap((node, index) =>
      node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
        ? [
            {
              id: node.getAttribute('data-plitzi-el') ?? '',
              text: (node instanceof HTMLElement ? node.innerText : node.textContent).replace(/\s+/g, ' ').trim(),
              cut: cuts(node) || (within && Array.from(node.querySelectorAll('*')).some(cuts)),
              index
            }
          ]
        : []
    )
  };
};

/**
 * Run in the page: what an attribute holds on each copy of an element shown — its own, or the one inside it that has it
 * (a link element's anchor) — as `textsInPage` reads their words.
 */
export const attributesInPage = ({ selector, attribute }: { selector: string; attribute: string }): Copies => {
  const nodes = Array.from(document.querySelectorAll(selector));
  const shown = nodes.filter(
    node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
  );

  return {
    present: nodes.length,
    shown: shown.map(node =>
      node.hasAttribute(attribute)
        ? (node.getAttribute(attribute) ?? '')
        : (node.querySelector(`[${attribute}]`)?.getAttribute(attribute) ?? '')
    ),
    cut: []
  };
};

/**
 * The copies of an element, as `textsInPage` read them and a visitor sees them: a copy drawn out of every visitor's
 * sight (`sights`, by its place in the page) is said apart, never shown — a run's panel clipped by its column under the
 * legend passed `--expect storm-name~ARNAB`. A copy whose sight was not read counts as seen.
 */
export const copiesOf = (
  { present, drawn }: ReturnType<typeof textsInPage>,
  sights: ReadonlyMap<number, Sight> = new Map()
): Copies => {
  const seen = drawn.filter(each => sights.get(each.index)?.seen !== false);
  const unseen = drawn.flatMap(each => {
    const sight = sights.get(each.index);

    return sight && !sight.seen ? [{ text: each.text, why: sightText(sight) }] : [];
  });
  const scrolled = Object.fromEntries(
    seen.flatMap((each, place) => {
      const sight = sights.get(each.index);

      return sight?.seen && sight.scrolled !== undefined ? [[place, sight.scrolled] as const] : [];
    })
  );

  return {
    present,
    shown: seen.map(each => each.text),
    cut: seen.flatMap((each, place) => (each.cut ? [place] : [])),
    ...(Object.keys(scrolled).length > 0 ? { scrolled } : {}),
    ...(unseen.length > 0 ? { unseen } : {})
  };
};

/** How many copies of one element have their sight read: a list's first rows — past them, one is read as seen. */
const SIGHTS_READ = 24;

/** What a visitor sees of each copy drawn, by its place in the page (`sightOf`, run on the element itself). */
const sightsOf = async (
  page: BrowserPage,
  selector: string,
  drawn: readonly DrawnText[]
): Promise<Map<number, Sight>> => {
  const sights = new Map<number, Sight>();
  for (const { index } of drawn.slice(0, SIGHTS_READ)) {
    sights.set(
      index,
      await page
        .locator(`${selector} >> nth=${String(index)}`)
        .first()
        .evaluate(sightOf, undefined)
    );
  }

  return sights;
};

/**
 * Where a visitor sees an element, in words (`--sight`): in sight, out of sight until a box is scrolled, or what keeps
 * every copy of it unseen — a run's look said "0.1% differs" of a task that added a whole panel below its column's fold.
 */
export const sightSaid = async (page: BrowserPage, selector: string): Promise<string> => {
  const texts = await page.evaluate(textsInPage, { selector, within: true });
  if (texts.present === 0) {
    return 'not on the page';
  }

  if (texts.drawn.length === 0) {
    return `on the page, nothing of it drawn${texts.present > 1 ? ` — all ${String(texts.present)} copies` : ''}`;
  }

  const sights = [...(await sightsOf(page, selector, texts.drawn)).values()];
  const seen = sights.filter(sight => sight.seen);
  if (seen.some(sight => sight.scrolled === undefined)) {
    return 'in sight';
  }

  return sightText(seen.at(0) ?? sights.at(0) ?? { seen: true });
};

/** The copies of an element as a visitor sees them: their words, and each one's sight. */
const seenCopies = async (page: BrowserPage, selector: string): Promise<Copies> => {
  const texts = await page.evaluate(textsInPage, { selector, within: true });

  return copiesOf(texts, await sightsOf(page, selector, texts.drawn));
};

const quoted = (shown: string): string => `"${shown.length > 160 ? `${shown.slice(0, 160)}…` : shown}"`;

/**
 * Why the page does not meet one `--expect`, or nothing when it does. Any copy meets it — a list's rows share their ids,
 * and a lead's "the list holds Juno" read the first row's Nova; `!` holds when none does — a guest shown no band.
 */
export const expectationMissed = (
  { element, text, absent }: Expectation,
  copies: Copies,
  onPage: readonly string[]
): string | undefined => {
  const said = `--expect ${absent ? '!' : ''}${element}${text === '' ? '' : `~${text}`}`;
  // In any case — a legend a stylesheet capitalises reads "ON AIR" — unless written in mixed case, which is read as
  // written: a line that must prove a capital (a display name "Juno" over a username "juno") could not be written.
  const asWritten = /\p{Lu}/u.test(text) && /\p{Ll}/u.test(text);
  const matching = (each: string): boolean =>
    asWritten ? each.includes(text) : each.toLowerCase().includes(text.toLowerCase());
  const showing = copies.shown.filter(matching);
  if (absent) {
    return showing.length === 0
      ? undefined
      : `${said}: ${element} ${text === '' ? 'is shown' : `shows ${quoted(showing[0] ?? '')}`}${copies.shown.length > 1 ? ` (${String(showing.length)} of its ${String(copies.shown.length)} copies)` : ''}`;
  }

  // Shown whole by one copy at least: a copy whose box cuts its words reads part of them, whatever its text holds.
  const whole = copies.shown.filter((each, index) => matching(each) && !copies.cut.includes(index));
  if (whole.length > 0 || (showing.length > 0 && text === '')) {
    return undefined;
  }

  const otherCase = asWritten ? copies.shown.find(each => each.toLowerCase().includes(text.toLowerCase())) : undefined;
  if (showing.length === 0 && otherCase !== undefined) {
    return `${said}: ${element} shows ${quoted(otherCase)} — in another case: a text written in mixed case is read as written (all one case to read any)`;
  }

  if (showing.length > 0) {
    return `${said}: ${element} holds it, and a visitor reads it cut short — its text runs past a box that cuts it (an ellipsis, a clipped overflow): give it room, or let it wrap`;
  }

  if (copies.present === 0) {
    return `${said}: no element ${element} is on the page${meantOnPage(element, onPage)}`;
  }

  // Drawn and out of every visitor's sight: what it holds is said, with what keeps it unseen.
  const unseen =
    copies.unseen?.find(each => matching(each.text)) ?? (copies.shown.length === 0 ? copies.unseen?.[0] : undefined);
  if (unseen) {
    return `${said}: ${element} ${text === '' || !matching(unseen.text) ? `shows ${quoted(unseen.text)}` : 'holds it'}, and no visitor sees it — ${unseen.why}`;
  }

  if (copies.shown.length === 0) {
    return `${said}: ${element} is on the page, hidden${copies.present > 1 ? ` — all ${String(copies.present)} copies` : ''}`;
  }

  return copies.shown.length === 1
    ? `${said}: ${element} shows ${quoted(copies.shown[0] ?? '')}`
    : `${said}: none of ${element}'s ${String(copies.shown.length)} copies shows it — ${copies.shown.slice(0, 4).map(quoted).join(', ')}${copies.shown.length > 4 ? '…' : ''}`;
};

/**
 * The links and buttons whose short label — three words at most — the page breaks onto more than one line: squeezed in
 * a row with no room (a menu one entry too long), which no other check sees. A link with nothing beside it is a title,
 * never said. In the page.
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
    // A dash between a track and its artist is no word: "Limitless — Elektronomia" is two.
    if (label === '' || label.split(' ').filter(word => /[\p{L}\p{N}]/u.test(word)).length > 3) {
      return [];
    }

    // A label is squeezed by what shares its row — a menu's next entry. A link alone across its column is a title (a
    // track's in a 210 px card column), which wraps as text does.
    const besideAnything = (from: Element): boolean => {
      let at = from;
      while (at.parentElement && at.parentElement !== document.body && at.parentElement.children.length === 1) {
        at = at.parentElement;
      }

      const box = at.getBoundingClientRect();

      return Array.from(at.parentElement?.children ?? []).some(other => {
        const near = other.getBoundingClientRect();

        return (
          other !== at &&
          near.width > 0 &&
          near.top < box.bottom &&
          near.bottom > box.top &&
          (near.right <= box.left || near.left >= box.right)
        );
      });
    };
    if (node instanceof HTMLAnchorElement && !besideAnything(node)) {
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
    ? ` — ${meant} is, ${String(copies)} times: a list’s row has the same ids in every row, so none is named per row; --expect ${meant}~<text> holds when any row shows it`
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
  for (const expected of expect) {
    const selector = selectorOf(authored, expected.element);
    const { attribute } = expected;
    const copies =
      attribute === undefined
        ? await seenCopies(page, selector)
        : await page.evaluate(attributesInPage, { selector, attribute });
    // An attribute's expectation is said as written: `site-sign-in[href]`, never the element's words.
    const named = attribute === undefined ? expected.element : `${expected.element}[${attribute}]`;
    const message = expectationMissed({ ...expected, element: named }, copies, onPage);
    if (message === undefined) {
      // Met only where a visitor scrolls a box to see it: said with it — a panel below its column's fold read as on screen.
      const scrolled = Object.values(copies.scrolled ?? {});
      const scrolledBy =
        expected.absent || scrolled.length < copies.shown.length || scrolled.length === 0 ? undefined : scrolled[0];
      met.push(
        `${expected.absent ? '!' : ''}${named}${expected.text === '' ? '' : `~${expected.text}`}${scrolledBy === undefined ? '' : ` (out of sight until ${scrolledBy} is scrolled)`}`
      );
    } else {
      missed.push({ code: 'expected-text', message, elementId: expected.element, width });
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
