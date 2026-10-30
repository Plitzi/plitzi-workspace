import type { Copy } from './act';
import type { RoutingPage } from '../answerAction';
import type { SettlingPage } from '../settle';

/**
 * What an e2e test needs of a browser page — Playwright's `Page` is one — given structurally, as `inspectPage` takes
 * one, so this package names no driver and installs none.
 */
/** One element of the page, as a step presses or reads it. */
export interface E2eElement {
  count(): Promise<number>;
  click(options: { timeout: number }): Promise<void>;
  hover(options: { timeout: number }): Promise<void>;
  fill(text: string, options: { timeout: number }): Promise<void>;
  /** A select's option chosen by its value or its label. */
  selectOption(value: string, options: { timeout: number }): Promise<unknown>;
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
}

/** The elements a selector finds: the first, the last or the nth. */
export interface E2eLocator extends E2eElement {
  first(): E2eElement;
  last(): E2eElement;
  nth(index: number): E2eElement;
}

export interface E2ePage extends SettlingPage, RoutingPage {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  emulateMedia(media: { colorScheme: 'light' | 'dark' }): Promise<void>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  locator(selector: string): E2eLocator;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  keyboard: { press(key: string): Promise<void> };
  mouse: {
    move(x: number, y: number, options?: { steps?: number }): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    wheel(dx: number, dy: number): Promise<void>;
  };
  goBack(options?: { waitUntil?: 'load' }): Promise<unknown>;
  reload(options?: { waitUntil?: 'load' }): Promise<unknown>;
  clock: { install(options: { time: number }): Promise<void>; runFor(ms: number): Promise<void> };
}

/** How long a space's page may take to take presses after it loads: a dev server compiles a page on its first request. */
export const HYDRATION_MS = 30_000;

/** How long a page may take to show a space at all: none by then, and it is no space's page — nothing to wait for. */
const SPACE_MS = 10_000;

/**
 * Waits for the space on the page to take its markup over (`data-hydrated`, put on its root by the SDK) — or says it did
 * not: a press before then does nothing, and what is read is the server's HTML. A page with no space has nothing to
 * wait for; one that hydrated answers at once.
 */
export const awaitHydration = async (page: E2ePage): Promise<string | undefined> => {
  const started = Date.now();
  const space = await page.waitForSelector('[data-hydrated], [data-plitzi-el]', { timeout: SPACE_MS }).then(
    () => true,
    () => false
  );
  if (!space) {
    return undefined;
  }

  const hydrated = await page
    .waitForSelector('[data-hydrated]', { timeout: Math.max(1, HYDRATION_MS - (Date.now() - started)) })
    .then(
      () => true,
      () => false
    );

  return hydrated
    ? undefined
    : `the page had not hydrated ${String(HYDRATION_MS / 1000)} s after it loaded, so a press would do nothing`;
};

/** The longest what a press started is waited for: a fade is a fraction of a second, an endless spin never ends. */
const SETTLE_MS = 3000;

/**
 * What a press started, finished: the page's animations ended, then its layout still — the boxes in view read alike
 * three times running (a drawer slid by its own code shows in no animation, only in the boxes moving). Bounded.
 */
export const settle = async (page: E2ePage): Promise<void> => {
  await page.evaluate(
    ({ most, every, still }: { most: number; every: number; still: number }) => {
      const until = Date.now() + most;
      const animations = Promise.all(
        document
          .getAnimations()
          .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
          .map(animation => animation.finished.catch(() => undefined))
      );
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
    { most: SETTLE_MS, every: 100, still: 3 }
  );
};

/** Playwright's call log once it dispatched a press: what happens after is no reason to press again. */
const PERFORMED = /performing \w+ action/;

/**
 * What Playwright waited on when a press timed out, in its call log — and whether the page settling may end it: what
 * covers the element, its moving and its being hidden may; a disabled control stays so.
 */
const PRESS_WAITS: readonly { said: RegExp; why: (line: string) => string; passes: boolean }[] = [
  {
    said: /intercepts pointer events/,
    why: line =>
      `${/data-plitzi-el="([^"]+)"/.exec(line)?.[1] ?? /<([\w-]+)/.exec(line)?.[1] ?? 'another element'} is drawn over it and takes the press — what covers it goes first (the step that closes it), or press that`,
    passes: true
  },
  { said: /element is not stable/, why: () => 'it was still moving (an animation, a layout settling)', passes: true },
  { said: /element is not visible/, why: () => 'it is not shown', passes: true },
  { said: /element is not enabled|disabled/, why: () => 'it is disabled', passes: false }
];

/**
 * Why a press did not happen, out of Playwright's log: the element over it, still moving, hidden or disabled — never its
 * first line alone ("locator.click: Timeout 3000ms exceeded", which a run's agents met a dozen times and could not act
 * on).
 */
export const pressFailure = (error: unknown): string => {
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
      ? `${first} — the page did not answer the press, even once still: wait for the element it loads first`
      : first
    : `${first} — ${why}`;
};

/**
 * A press made once. Timed out before it went out — something over it, still moving, a page busy on its first load — the
 * page is let settle and it is made again; a disabled control waits for nothing; timed out after it went out
 * (Playwright waiting on what it set off, on a busy page) it is never made again: a toggle pressed twice reads as never
 * pressed (run `hazards-all`, 2026-10-30).
 */
export const pressOnce = async (page: E2ePage, press: () => Promise<unknown>): Promise<void> => {
  try {
    await press();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const waited = /Timeout/.test(message) && !PRESS_WAITS.some(each => !each.passes && each.said.test(message));
    if (!waited) {
      throw error;
    }

    await settle(page);
    if (PERFORMED.test(message)) {
      return;
    }

    await press();
  }
};

/** The copy a target names — `bin-bar:3`, `bin-bar:last` — of what a selector finds, else the first. */
const copyOf = (all: E2eLocator, copy: string | undefined): E2eElement =>
  copy === undefined ? all.first() : copy === 'last' ? all.last() : all.nth(Number(copy) - 1);

/** The mark the SDK draws an element with, as a selector. */
const markOf = (id: string): string => `[data-plitzi-el="${id.replace(/"/g, '\\"')}"]`;

/**
 * What a target names, as a selector and the copy — `bin-bar:3` the third a list draws, `bin-bar:last` the last, else
 * none named.
 */
export const targetOf = (target: string): { selector: string; copy: Copy } => {
  const copy = /^(.+):(\d+|last)$/.exec(target);

  return {
    selector: markOf(copy ? copy[1] : target),
    copy: copy === null ? undefined : copy[2] === 'last' ? 'last' : Number(copy[2])
  };
};

/** The fields an element is or holds: itself when it is one, else those inside it — a form control draws its own. */
export const fieldsOf = (selector: string): string => `${selector}${FIELD}, ${selector} ${FIELD}`;

/**
 * An element as a step names it — `bin-bar`, the third copy a list draws `bin-bar:3`, the last `bin-bar:last` — found
 * on the page by the mark the SDK draws every element with.
 */
export const locateTarget = (page: E2ePage, target: string): E2eElement => {
  const copy = /^(.+):(\d+|last)$/.exec(target);

  return copyOf(page.locator(markOf(copy ? copy[1] : target)), copy?.[2]);
};

const FIELD = ':is(input, textarea, select, [contenteditable=""], [contenteditable="true"])';

/**
 * The field a `type` step writes in: the element, when it is one — or the field inside it, as a form control draws its
 * input within the element its id marks.
 */
export const locateField = (page: E2ePage, target: string): E2eElement => {
  const copy = /^(.+):(\d+|last)$/.exec(target);

  return copyOf(page.locator(fieldsOf(markOf(copy ? copy[1] : target))), copy?.[2]);
};

/** The element's id a target names, its copy left out. */
export const targetId = (target: string): string => target.replace(/:(?:\d+|last)$/, '');
