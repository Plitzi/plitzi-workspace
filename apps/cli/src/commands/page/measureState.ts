import { pressFailure, pressOnce, settle } from '@plitzi/sdk-authoring';

import { targetOn } from './shot/capture';

import type { Asked, Pair } from './measure';
import type { BrowserPage, PageElement } from '../../browser';
import type { SettlingRequest } from '@plitzi/sdk-authoring';

/**
 * The state `page measure` reads both pages in — an element hovered or focused, or several clicked in turn — put on a
 * page and waited for, and said in words.
 */

/** The state both pages are measured in: an element of each hovered or focused first, or clicked, one after another. */
export interface StateAsked {
  kind: 'hover' | 'focus' | 'press' | 'click';
  /** One hovered or focused; clicked, each in turn. */
  pairs: Pair[];
  /**
   * After the clicks, one element hovered or focused: a state reached in two moves — a menu opened, an item of it
   * hovered (a run's design-1 asked it of `page measure` and `page shot`, and was refused).
   */
  then?: { kind: 'hover' | 'focus' | 'press'; pair: Pair };
}

const DONE: Record<StateAsked['kind'], string> = {
  hover: 'hovered',
  focus: 'focused',
  press: 'held down',
  click: 'clicked'
};

/** The longest what a step asked the server is waited for: a server action, a provider read again. */
const ANSWER_MS = 5000;

/**
 * A step run with what it asks the server answered before the page is read: a run's down key, lit by the vote's
 * answer, measured unlit — `--click` read the page before the action landed. A stream (an event source, a socket) never
 * finishes, and is not waited for.
 */
export const answered = async (page: BrowserPage, step: () => Promise<void>): Promise<void> => {
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
    await step();
    for (const until = Date.now() + ANSWER_MS; pending.size > 0 && Date.now() < until;) {
      await page.waitForTimeout(50);
    }
  } finally {
    page.off('request', asked);
    page.off('requestfinished', done);
    page.off('requestfailed', done);
  }
};

/** The state in words: `menu-toggle clicked, then submenu-row`. */
export const stateText = (state: StateAsked, side: keyof Pair): string =>
  `${state.pairs.map(pair => pair[side]).join(', then ')} ${DONE[state.kind]}${state.then ? `, then ${state.then.pair[side]} ${DONE[state.then.kind]}` : ''}`;

/**
 * What a step of the state does to its element. A focus is a keyboard's — a key pressed first, then the element focused —
 * so what the page draws on `:focus-visible` is drawn: focused by script alone, a run's focus ring never showed.
 */
const act = async (page: BrowserPage, element: PageElement, kind: StateAsked['kind']): Promise<void> => {
  if (kind === 'hover') {
    await element.hover({ timeout: 5000 });
  } else if (kind === 'focus') {
    await page.keyboard.press('Shift');
    await element.focus({ timeout: 5000 });
  } else if (kind === 'press') {
    // Held, never let go: what the page draws on `:active` — a key pressed down — read while it is; a review of a latched
    // key could not measure whether pressing it pops it up.
    await element.hover({ timeout: 5000 });
    await page.mouse.down();
  } else {
    await element.click({ timeout: 5000 });
  }
};

/**
 * Puts the page in the state asked — the element hovered or focused, or each clicked in turn — and waits for what it
 * starts to finish: a drawer's slide, a panel's fade.
 */
export const putIn = async (
  page: BrowserPage,
  state: StateAsked,
  side: keyof Pair
): Promise<{ problem: string } | undefined> => {
  const steps = [
    ...state.pairs.map(pair => ({ kind: state.kind, pair })),
    ...(state.then ? [{ kind: state.then.kind, pair: state.then.pair }] : [])
  ];
  for (const { kind, pair } of steps) {
    const target = pair[side];
    const found = await targetOn(page, target);
    if ('problem' in found) {
      return found;
    }

    if (!found.found) {
      return { problem: `No element ${target} to ${kind} on ${page.url()}` };
    }

    try {
      const element = page.locator(found.selector).filter({ visible: true }).first();
      // A click may ask the server: what it lit is read once that lands. A hover or a focus asks nothing.
      await (kind === 'click'
        ? answered(page, () => pressOnce(page, () => act(page, element, kind)))
        : pressOnce(page, () => act(page, element, kind)));
    } catch (error) {
      return { problem: `${target} could not be ${DONE[kind]} on ${page.url()}: ${pressFailure(error)}` };
    }

    await settle(page);
  }

  return undefined;
};

/** How many copies of one element `--each` measures, at most: a run's strip of 24 bars was cut at 20, unsaid. */
export const ROWS_MOST = 100;

/** How far the copies past those are counted, to say how many were left. */
const COUNTED_MOST = 1000;

/**
 * Every row a list draws of an element, as its own selector — the element alone when it is drawn once — and those past
 * `ROWS_MOST`, as one pair that says how many.
 */
export const copiesOf = async (page: BrowserPage, pair: Pair): Promise<Asked[]> => {
  const found = await targetOn(page, pair.here);
  if ('problem' in found || !found.found) {
    return [pair];
  }

  let count = 0;
  while (
    count < COUNTED_MOST &&
    (await page
      .locator(`${found.selector} >> nth=${String(count)}`)
      .first()
      .count()) > 0
  ) {
    count += 1;
  }

  if (count <= 1) {
    return [pair];
  }

  const rows = Array.from({ length: Math.min(count, ROWS_MOST) }, (_, index) => ({
    here: `${found.selector} >> nth=${String(index)}`,
    there: pair.there
  }));

  return count > ROWS_MOST
    ? [...rows, { here: `${found.selector} >> nth=${String(ROWS_MOST)}`, there: pair.there, beyond: count - ROWS_MOST }]
    : rows;
};
