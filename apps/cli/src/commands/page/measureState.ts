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

/** The longest a state's transitions are waited for: a fade is a fraction of a second, an endless spin never ends. */
const SETTLE_MS = 3000;

/** How often the page's layout is read while it settles, and how many reads alike in a row count as still. */
const LAYOUT_EVERY_MS = 100;
const LAYOUT_STILL = 3;

/**
 * What the state started finished, or the longest a fade takes: the page's animations ended, then its layout still —
 * the boxes of what is in view read alike three times running. A script that moves a panel frame by frame (a drawer
 * slid in by its own code) shows in no animation of the page, only in the boxes moving.
 */
export const settle = async (page: BrowserPage): Promise<void> => {
  await page.evaluate(
    ({ most, every, still }: { most: number; every: number; still: number }) => {
      const until = Date.now() + most;
      const animations = Promise.all(
        document
          .getAnimations()
          .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
          .map(animation => animation.finished.catch(() => undefined))
      );
      // Where the elements in view are drawn: one line of numbers, read again until it stops changing.
      const layout = (): string =>
        [...document.body.querySelectorAll('*')]
          .slice(0, 600)
          .map(node => node.getBoundingClientRect())
          .filter(box => box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth)
          .map(box => `${String(Math.round(box.left))},${String(Math.round(box.top))},${String(Math.round(box.width))}`)
          .join(' ');
      const stillLayout = async (): Promise<void> => {
        let last = layout();
        let alike = 0;
        while (alike < still && Date.now() < until) {
          await new Promise(resolve => setTimeout(resolve, every));
          const now = layout();
          alike = now === last ? alike + 1 : 0;
          last = now;
        }
      };

      return Promise.race([
        animations.then(stillLayout),
        new Promise(resolve => setTimeout(resolve, Math.max(0, until - Date.now())))
      ]).then(() => undefined);
    },
    { most: SETTLE_MS, every: LAYOUT_EVERY_MS, still: LAYOUT_STILL }
  );
};

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

/** What Playwright logs while it waits to press: the element over it, still moving, not shown, disabled. */
const PRESS_WAITS: readonly { said: RegExp; why: (line: string) => string; passes: boolean }[] = [
  {
    said: /intercepts pointer events/,
    why: line =>
      `${/data-plitzi-el="([^"]+)"/.exec(line)?.[1] ?? /<([\w-]+)/.exec(line)?.[1] ?? 'another element'} is drawn over it and takes the press — what covers it goes first (the step that closes it), or press that`,
    passes: true
  },
  { said: /element is not stable/, why: () => 'it was still moving (an animation, a layout settling)', passes: true },
  { said: /element is not visible/, why: () => 'it is not shown', passes: true },
  // `passes`: what the page settling may end — a disabled control stays so.
  { said: /element is not enabled|disabled/, why: () => 'it is disabled', passes: false }
];

/**
 * Why a step's press did not happen, out of Playwright's log: the element over it, still moving, hidden or disabled —
 * never its first line alone ("locator.click: Timeout 3000ms exceeded", which a run's agents met a dozen times, read
 * as "hidden, covered or disabled", and could not act on).
 */
export const stepFailure = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const [first = '', ...log] = error.message.split('\n');
  // The last of each: what it was waiting on when the time ran out.
  const why = [...log]
    .reverse()
    .flatMap(line => PRESS_WAITS.filter(each => each.said.test(line)).map(each => each.why(line)))
    .at(0);

  // Nothing it waited on said, after the page was let settle: it never answered the press — busy, or the press went
  // nowhere it could tell.
  return why === undefined
    ? /^locator\.(?:click|dblclick|tap|hover)\b.*Timeout/.test(first)
      ? `${first} — the page did not answer the press, even once still: a wait-for <el> first waits for what it loads`
      : first
    : `${first} — ${why}`;
};

/**
 * A press that waits out what the page is still doing: timed out with something over it or moving — a boot screen
 * fading, a page busy on its first load — it is tried once more when the page has settled (`settle`). A run's agents
 * found every first click of a page timing out until they put a `wait 4000` before it.
 */
/** Playwright's call log once it dispatched the press: what happens after is no reason to press again. */
const PERFORMED = /performing \w+ action/;

export const patiently = async (page: BrowserPage, press: () => Promise<unknown>): Promise<void> => {
  try {
    await press();
  } catch (error) {
    // Timed out on what the page was still doing — something over it, moving, not yet shown, or a page too busy loading
    // to answer at all (a run's check clicked a phone's tab in a development build 13 s busy, and failed with nothing
    // said): once more, when the page is still. A disabled control waits for nothing.
    const waited =
      error instanceof Error &&
      /Timeout/.test(error.message) &&
      !PRESS_WAITS.some(each => !each.passes && each.said.test(error.message));
    if (!waited) {
      throw error;
    }

    // Pressed already, timed out after — on a busy page Playwright's wait for what the press set off outlasts it: pressed
    // again, a toggle was put back, and a run's clicks read as never made (its call log said "click action done").
    if (error instanceof Error && PERFORMED.test(error.message)) {
      await settle(page);

      return;
    }

    await settle(page);
    await press();
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
        ? answered(page, () => patiently(page, () => act(page, element, kind)))
        : patiently(page, () => act(page, element, kind)));
    } catch (error) {
      return { problem: `${target} could not be ${DONE[kind]} on ${page.url()}: ${stepFailure(error)}` };
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
