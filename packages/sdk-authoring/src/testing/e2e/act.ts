import type { E2eElement, E2eLocator, E2ePage } from './page';
import type { SettlingPage, SettlingRequest } from '../settle';

/**
 * How a visitor's press is made on a page, whatever named what it presses: a journey of the space's document (an
 * element's id) or a step of the CLI's `page play` / `check --steps` (a name, a selector, a row). One way for both, so
 * what one learns — a copy hidden at this width, a select chosen, a range pressed at its thumb — the other has.
 */

/** Which of the elements a selector finds a step acts on: the nth (from 1), the last, or the first a visitor sees. */
export type Copy = number | 'last' | undefined;

/**
 * The copy a step acts on, and how many the page has: the one named — or, named none, the first one shown, as a page
 * that draws a control per width hides the other (a phone's drawer field, first in the document, timed out at 1440
 * where the column's own was there). What is on the page and shown nowhere is said apart from what is not on it. `at`
 * is the copy's place among them, from 0.
 */
export const shownCopy = async (
  page: Pick<E2ePage, 'locator'>,
  selector: string,
  copy: Copy = undefined
): Promise<{ element: E2eElement; at: number; copies: number } | { absent: true } | { hidden: true }> => {
  const all: E2eLocator = page.locator(selector);
  const copies = await all.count();
  if (copies === 0) {
    return { absent: true };
  }

  if (copy !== undefined) {
    const element = copy === 'last' ? all.last() : all.nth(copy - 1);
    if ((await element.count()) === 0) {
      return { absent: true };
    }

    return (await element.boundingBox()) === null
      ? { hidden: true }
      : { element, at: copy === 'last' ? copies - 1 : copy - 1, copies };
  }

  for (let index = 0; index < copies; index += 1) {
    const element = all.nth(index);
    if ((await element.boundingBox()) !== null) {
      return { element, at: index, copies };
    }
  }

  return { hidden: true };
};

/** What a step says of an element on the page and shown nowhere at this width. */
export const hiddenAtWidth = (target: string, kind: string): string =>
  `${target} is on the page but hidden at this width — a breakpoint, or a menu that is closed: ${kind} what a visitor sees here, or play it at the width that shows it`;

/**
 * Runs in the page: the field a value is given to rather than typed in — a select, chosen; a date, a time, a colour or a
 * range, set — the element itself or the one field of that kind inside it (a form control wraps its own). Serialised.
 */
export const valueFieldIn = (selector: string): { selector: string; how: 'select' | 'value' } | undefined => {
  let node: Element | null;
  try {
    node = document.querySelector(selector);
  } catch {
    // A selector only a browser driver reads (`>> nth=1`): typed into as it is.
    return undefined;
  }

  if (node === null) {
    return undefined;
  }

  const kinds = [
    { how: 'select', matches: 'select' },
    {
      how: 'value',
      matches: ['date', 'time', 'datetime-local', 'month', 'week', 'color', 'range']
        .map(type => `input[type="${type}"]`)
        .join(', ')
    }
  ] as const;
  for (const kind of kinds) {
    if (node.matches(kind.matches)) {
      return { selector, how: kind.how };
    }

    const inside = node.querySelectorAll(kind.matches);
    const only = inside.length === 1 ? inside[0] : undefined;
    if (only) {
      const type = only.getAttribute('type');

      return {
        selector: `${selector} ${type === null ? only.localName : `${only.localName}[type="${type}"]`}`,
        how: kind.how
      };
    }
  }

  return undefined;
};

/**
 * Gives `text` to a field that is not typed into — a select's option chosen, a date or a range set — and says it did;
 * `false` for a field a visitor types in, left to the caller.
 */
export const giveValue = async (
  page: Pick<E2ePage, 'evaluate' | 'locator'>,
  selector: string,
  text: string,
  copy: Copy = undefined
): Promise<boolean> => {
  const given = await page.evaluate(valueFieldIn, selector);
  if (given === undefined) {
    return false;
  }

  const all = page.locator(given.selector);
  const field = copy === undefined ? all.first() : copy === 'last' ? all.last() : all.nth(copy - 1);
  await (given.how === 'select' ? field.selectOption(text, { timeout: 3000 }) : field.fill(text, { timeout: 3000 }));

  return true;
};

/** Runs in the page: where along a range its value puts the thumb — its middle for any other element. Serialised. */
const thumbAlong = (selector: string): number => {
  let node: Element | null = null;
  try {
    node = document.querySelector(selector);
  } catch {
    return 0.5;
  }

  if (!(node instanceof HTMLInputElement) || node.type !== 'range') {
    return 0.5;
  }

  const [min, max] = [Number(node.min || 0), Number(node.max || 100)];

  return max > min ? (Number(node.value) - min) / (max - min) : 0.5;
};

/**
 * Pressed, moved in steps a hand would make, let go — a range at its thumb, where its value puts it (pressed at its
 * middle, the other handle of a two-handle price range moved instead). `held` keeps the finger down for what follows to
 * read the page mid-drag. Answers why it could not, or nothing.
 */
export const dragElement = async (
  page: Pick<E2ePage, 'evaluate' | 'mouse'>,
  element: E2eElement,
  selector: string,
  { dx, dy, held = false }: { dx: number; dy: number; held?: boolean }
): Promise<string | undefined> => {
  const box = await element.boundingBox();
  if (box === null) {
    return 'it is not shown — nothing to drag';
  }

  const along = await page.evaluate(thumbAlong, selector);
  // The thumb travels the track less its own width, about the input's height: at its end it sits inside it.
  const thumb = Math.min(box.height, box.width);
  const [x, y] = [box.x + thumb / 2 + (box.width - thumb) * along, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  if (!held) {
    await page.mouse.up();
  }

  return undefined;
};

/** The longest what a press asked the server is waited for: a server action, a provider read again. */
const ANSWER_MS = 5000;

/**
 * A press made with what it asks the server answered before the page is read: a vote's key lit by its answer, read unlit
 * when the page was read as the press went out. A stream (an event source, a socket) never finishes, and is not waited
 * for; a page that tells no requests (the builder's canvas) waits for none.
 */
export const answered = async (
  page: Pick<SettlingPage, 'on' | 'off' | 'waitForTimeout'>,
  press: () => Promise<void>
): Promise<void> => {
  const pending = new Set<SettlingRequest>();
  const asked = (request: SettlingRequest): void => {
    const { accept = '' } = request.headers();
    if (['fetch', 'xhr'].includes(request.resourceType()) && !accept.includes('text/event-stream')) {
      pending.add(request);
    }
  };
  const done = (request: SettlingRequest): void => {
    pending.delete(request);
  };
  page.on('request', asked);
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  try {
    await press();
    for (const until = Date.now() + ANSWER_MS; pending.size > 0 && Date.now() < until;) {
      await page.waitForTimeout(50);
    }
  } finally {
    page.off('request', asked);
    page.off('requestfinished', done);
    page.off('requestfailed', done);
  }
};
