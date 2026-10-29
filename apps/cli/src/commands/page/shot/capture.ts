import { comparePictures, loadImages, openPage, unrollPage } from '@plitzi/sdk-authoring';
import { MOTION_STILL_CSS } from '@plitzi/sdk-shared/schema';

import { dataUrl, openOtherPage, paintedScheme, projectSettling } from '../../../browser';
import { saySignedIn, sentElsewhere, signInWhereSent } from '../check';
import { prepareVisit } from '../visit';
import { BARE, IMAGES_BUDGET_MS, REMOTE_IMAGES_BUDGET_MS, WAITING_FOR_SCROLL } from './types';
import { projectRun } from '../../../scaffold/packageManager';

import type { Framing, Taken, View } from './types';
import type { Browser, BrowserPage } from '../../../browser';

/**
 * A picture taken: of the page, the viewport or one element, once what it waits for has arrived.
 */

/** A bare word: an element's name — letters, digits, `-` and `_`, as an id is written — or else a tag (`textarea`). */
export const namedBy = (target: string): string => `[data-plitzi-el="${target}"]`;

/** A bare word as an id selector, where CSS reads it as one: never one that starts with a digit. */
const idOf = (target: string): string[] => (/^[A-Za-z_]/.test(target) ? [`#${target}`] : []);

/**
 * An element by the name every page command takes: the space's element of that name, or — a plugin's own part, which
 * no element names (`reactions-more`, inside the Reactions plugin) — the node of that id. `page play` found a plugin's
 * picker that `page check --click` said was not on the page (a run's t-emojis).
 */
export const byNameOrId = (name: string): string => [namedBy(name), ...idOf(name)].join(', ');

/** A section as a comparison's report names it: its tag, and its id or its element's name. */
const REGION = /^([a-z][a-z0-9]*)#([\w-]+)(?::(\d+))?$/;
/** `room-card-name:last`, `room-card-name:2`: one row's element of a list, where a bare name is the first row's. */
export const ROW = /^([A-Za-z_][\w-]*):(last|\d+)$/;

/**
 * A reading of the page, once more when the page navigated under it: a project served with its watch reloads the page
 * when its space changes — a run's preview at each approval (`page shot --compare` died with "Execution
 * context was destroyed"). Twice, it is refused as what it is.
 */
export const readPage = async <R, A>(
  page: Pick<BrowserPage, 'evaluate' | 'waitForLoadState' | 'url'>,
  read: (input: A) => R | Promise<R>,
  input: A
): Promise<R> => {
  const navigated = (error: unknown): boolean =>
    error instanceof Error && /Execution context was destroyed|navigation/i.test(error.message);
  try {
    return await page.evaluate(read, input);
  } catch (error) {
    if (!navigated(error)) {
      throw error;
    }
  }

  await page.waitForLoadState('load');
  try {
    return await page.evaluate(read, input);
  } catch (error) {
    if (navigated(error)) {
      throw new Error(
        `The page kept reloading while it was read (${page.url()}): its server reloads it as the space changes — read it again once it is still`,
        { cause: error }
      );
    }

    throw error;
  }
};

/** What a wait waits for: an element by name or, a bare word naming none, a tag — whichever shows first. */
export const awaited = (target: string): string => {
  const region = REGION.exec(target);
  if (region) {
    // A copy's place (`:2`) is no CSS: waited for as the part, whose copies a page draws together.
    return `${region[1]}#${region[2]}, ${region[1]}${namedBy(region[2])}`;
  }

  // A component's instance too, as `targetOn` finds it: waited for by its name alone, a run's clip of one said
  // "not on the page" while page measure read it.
  return BARE.test(target)
    ? [namedBy(target), target, ...idOf(target), `[data-plitzi-instance="${target}"]`].join(', ')
    : target;
};

/**
 * Of the elements `selector` finds, the place of the one that shows the most of `ids` — itself or what it holds, drawn
 * — the first on a tie: a component's instances, in different states. Runs in the page.
 */
export const mostShowingInPage = ({ selector, ids }: { selector: string; ids: readonly string[] }): number => {
  const wanted = new Set(ids);
  const drawn = (element: Element): boolean => element.getClientRects().length > 0;
  const counts = Array.from(document.querySelectorAll(selector)).map(
    found =>
      [found, ...Array.from(found.querySelectorAll('[data-plitzi-el]'))].filter(
        each => wanted.has(each.getAttribute('data-plitzi-el') ?? '') && drawn(each)
      ).length
  );
  const best = Math.max(0, ...counts);

  return best === 0 ? 0 : counts.indexOf(best);
};

/**
 * A target found on the page: an element's name, a tag no element is named by (`textarea`), or a selector — CSS or
 * Playwright's own (`button:has-text("Orbit")`, `text=Saved`, `role=button[name="Publish"]`). With how many it finds
 * (none is one not on the page), or why it is no selector at all: Playwright throws on one it cannot read, and an
 * uncaught throw ended the command with a stack trace.
 */
export const targetOn = async (
  page: { locator(selector: string): { first(): { count(): Promise<number> } } },
  target: string
): Promise<{ selector: string; found: boolean } | { problem: string }> => {
  try {
    const found = async (selector: string): Promise<boolean> => (await page.locator(selector).first().count()) > 0;
    // A section as a comparison names it, `section#home-sponsors`: its id, or its element's name — the report writes
    // either the same way, and `--scroll-to` answered "not on" for the name it printed (a run's design-1).
    const region = REGION.exec(target);
    if (region) {
      const [, tag, name, place] = region;
      // `header#match-heading-root:2`: the second copy of a component's part, as a comparison numbers them.
      // An optional group is undefined when absent, whatever its type says: read as truthy, never compared.
      const nth = place ? ` >> nth=${String(Number(place) - 1)}` : '';
      const asWritten = `${tag}#${name}${nth}`;
      const named = `${tag}${namedBy(name)}${nth}`;

      return (await found(asWritten))
        ? { selector: asWritten, found: true }
        : { selector: named, found: await found(named) };
    }

    // A run's designer could not read the card its step added to a list: only the first row's was read.
    const row = ROW.exec(target);
    if (row) {
      const [, name, place] = row;
      const selector = `${namedBy(name)} >> nth=${place === 'last' ? '-1' : String(Number(place) - 1)}`;

      return { selector, found: await found(selector) };
    }

    if (!BARE.test(target)) {
      if (await found(target)) {
        return { selector: target, found: true };
      }

      // `#home-fights-main > …`: an element's name written as an id, where the page has none by that id — the name is
      // what a person reads in the builder and in a report (a run's design-1 met "not on" for each).
      const byName = target.replace(/#([A-Za-z_][\w-]*)/g, (_match, name: string) => namedBy(name));
      if (byName !== target && (await found(byName))) {
        return { selector: byName, found: true };
      }

      // `article-table td`: an element's name, then what is inside it — the name read as the element's, as a bare word
      // is (a run's dev-2 wrote [data-plitzi-el="article-table"] td by hand). `product-dot:nth-child(3)`: a name with
      // a pseudo-class, an attribute or a class written on it, read the same way (16 checks failed).
      const [first, ...rest] = target.trim().split(/\s+/);
      const leading = /^([A-Za-z_][\w-]*)((?:[:[.][^\s]*)?)$/.exec(first);
      if (leading && (rest.length > 0 || leading[2] !== '')) {
        const inside = [`${namedBy(leading[1])}${leading[2]}`, ...rest].join(' ');
        if (await found(inside)) {
          return { selector: inside, found: true };
        }
      }

      return { selector: target, found: false };
    }

    // A bare word: an element's name, a tag — or an id, as a section's anchor is (`--within combates`) — or a component's
    // instance, which has no node of its own: its root carries its name (`fights-heading`, a run's lead).
    for (const selector of [namedBy(target), target, ...idOf(target), `[data-plitzi-instance="${target}"]`]) {
      if (await found(selector)) {
        return { selector, found: true };
      }
    }

    return { selector: namedBy(target), found: false };
  } catch (error) {
    return {
      problem: `${target} is neither an element's name nor a selector the page can read: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    };
  }
};

const framing = (view: { viewport?: boolean; scrollTo?: string }, clip?: string): Framing => {
  if (clip) {
    return { kind: 'element', selector: clip };
  }

  return view.viewport || view.scrollTo ? { kind: 'viewport' } : { kind: 'page' };
};

/**
 * Runs in the page: the screen's height when the page is drawn as a screen of its own — its document locked
 * (`documentScroll: 'locked'`: html and body with no scroll) — its panes scrolling inside it; undefined when the
 * document scrolls. Self-contained — it is serialised.
 */
export const lockedScreen = (): number | undefined =>
  [document.documentElement, document.body].some(each => {
    const { overflowY } = getComputedStyle(each);

    return overflowY === 'hidden' || overflowY === 'clip';
  })
    ? window.innerHeight
    : undefined;

/**
 * Runs in the page: how much more a sheet pinned to the screen holds than it shows — a modal page (a run's room
 * stats) scrolls inside itself, and a whole-page picture showed its first screen alone. The widest such scroller's,
 * 0 when there is none. Self-contained — it is serialised.
 */
export const pinnedScroll = (): number => {
  let more = 0;
  for (const element of document.querySelectorAll<HTMLElement>('body *')) {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (box.width < window.innerWidth / 2) {
      continue;
    }

    // Pinned itself, past the screen's foot or holding more than its box — a sheet the whole-page walk (`unrollPage`) let
    // grow, or one held to the screen by its insets whose rows spill out of it (a run's stats panel).
    if (style.position === 'fixed') {
      more = Math.max(
        more,
        Math.round(box.bottom - window.innerHeight),
        element.clientHeight > 0 ? element.scrollHeight - element.clientHeight : 0
      );
    }

    const scrolls =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') && element.scrollHeight > element.clientHeight + 1;
    let pinned = false;
    for (let at: HTMLElement | null = element; at && scrolls && !pinned; at = at.parentElement) {
      pinned = getComputedStyle(at).position === 'fixed';
    }

    if (pinned) {
      more = Math.max(more, element.scrollHeight - element.clientHeight);
    }
  }

  return more;
};

/** How long a picture waits for a canvas to be drawn — a map's tiles, a chart's first frame — at most. */
const CANVAS_MS = 4_000;

/** How often a canvas is looked at while it is drawn. */
const CANVAS_EVERY_MS = 250;

/** Below this share of a canvas changing between two looks it is drawn: what moves still is its own motion. */
const CANVAS_STILL_PERCENT = 2;

/**
 * Runs in the page: the largest canvas in view worth waiting for — a map, a chart — by its place in the document, or
 * none. Self-contained — it is serialised.
 */
export const largestCanvas = (): { x: number; y: number; width: number; height: number } | undefined => {
  let found: { x: number; y: number; width: number; height: number } | undefined;
  for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
    const box = canvas.getBoundingClientRect();
    const left = Math.max(box.left, 0);
    const top = Math.max(box.top, 0);
    const width = Math.min(box.right, window.innerWidth) - left;
    const height = Math.min(box.bottom, window.innerHeight) - top;
    if (width >= 120 && height >= 120 && (!found || width * height > found.width * found.height)) {
      found = { x: left + window.scrollX, y: top + window.scrollY, width, height };
    }
  }

  return found;
};

/**
 * Whether the page's canvas is drawn before it is pictured: looked at until two looks barely differ — or not within
 * `CANVAS_MS`, which is said. A run's look compared a globe the run before had not drawn yet (a pale disc, "13.4%
 * differs"), and pictured a page before its globe and panel were there.
 */
export const canvasDrawn = async (page: BrowserPage): Promise<boolean> => {
  const clip = await page.evaluate(largestCanvas, undefined);
  if (!clip) {
    return true;
  }

  let before = await page.screenshot({ fullPage: true, clip });
  for (const until = Date.now() + CANVAS_MS; Date.now() < until;) {
    await page.waitForTimeout(CANVAS_EVERY_MS);
    const now = await page.screenshot({ fullPage: true, clip });
    const { changed } = await comparePictures(page, dataUrl(before), dataUrl(now));
    if (changed < CANVAS_STILL_PERCENT) {
      return true;
    }

    before = now;
  }

  return false;
};

/** The attribute a pinned element hidden for an element's picture carries: its own opacity, put back after. */
export const HIDDEN_FOR_SHOT = 'data-plitzi-shot-hidden';

/**
 * Runs in the page: every element pinned to the screen (fixed or sticky), or placed over the target from outside it
 * (absolute, its box on the target's), that is neither the target, inside it nor around it, hidden — what is drawn over a part scrolled to the top of the screen, a site's sticky header over the
 * first rows of a run's queue in every clipped picture. Hidden by its opacity, which nothing in it can undo — a
 * header's children kept `visibility: visible` of their own, and were drawn over every part a look pictured at 390 —
 * and its box kept, so nothing moves. Self-contained — it is serialised.
 */
export const hidePinned = (target: Element, attribute: string): number => {
  let hidden = 0;
  const own = target.getBoundingClientRect();
  // Placed over it from outside — a HUD's bar set absolutely over its column: drawn over a part pictured beneath it.
  const over = (element: Element): boolean => {
    const box = element.getBoundingClientRect();

    return (
      box.width > 0 &&
      box.height > 0 &&
      box.left < own.right &&
      box.right > own.left &&
      box.top < own.bottom &&
      box.bottom > own.top
    );
  };
  for (const element of document.querySelectorAll<HTMLElement>('body *')) {
    const { position } = getComputedStyle(element);
    if (
      (position === 'fixed' || position === 'sticky' || (position === 'absolute' && over(element))) &&
      !element.contains(target) &&
      !target.contains(element) &&
      !element.hasAttribute(attribute)
    ) {
      element.setAttribute(
        attribute,
        `${element.style.getPropertyValue('opacity')}|${element.style.getPropertyPriority('opacity')}`
      );
      element.style.setProperty('opacity', '0', 'important');
      hidden += 1;
    }
  }

  return hidden;
};

/** Runs in the page: what `hidePinned` hid, shown again as it was. Self-contained — it is serialised. */
export const showPinned = (attribute: string): void => {
  for (const element of document.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    const [value = '', priority = ''] = (element.getAttribute(attribute) ?? '').split('|');
    if (value === '') {
      element.style.removeProperty('opacity');
    } else {
      element.style.setProperty('opacity', value, priority);
    }

    element.removeAttribute(attribute);
  }
};

/**
 * One element's picture, nothing pinned to the screen drawn over it — the one way an element is pictured: a part set
 * beside the run before was pictured another way, a site's sticky header over it (a run's looks at 390).
 */
export const elementShot = async (page: BrowserPage, selector: string): Promise<Uint8Array> => {
  const element = page.locator(selector).first();
  await element.evaluate(hidePinned, HIDDEN_FOR_SHOT);
  try {
    return await element.screenshot();
  } finally {
    await page.evaluate(showPinned, HIDDEN_FOR_SHOT);
  }
};

export const capture = async (page: BrowserPage, how: Framing): Promise<Uint8Array> => {
  if (how.kind === 'element') {
    return elementShot(page, how.selector);
  }

  if (how.kind === 'element-later') {
    const read = await targetOn(page, how.target);
    const shown = !('problem' in read) && read.found && (await page.locator(read.selector).first().isVisible());

    return shown ? elementShot(page, read.selector) : page.screenshot({ fullPage: false });
  }

  if (how.kind === 'page') {
    // A sheet pinned over the page, scrolling on its own, is pictured whole: the screen made as tall as what it holds.
    const more = await page.evaluate(pinnedScroll, undefined);
    if (more > 0) {
      const size = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }), undefined);
      await page.setViewportSize({ width: size.width, height: size.height + more });
      try {
        return await page.screenshot({ fullPage: true });
      } finally {
        await page.setViewportSize(size);
      }
    }
  }

  return page.screenshot({ fullPage: how.kind === 'page' });
};

/**
 * Runs in the page: every animation that ends, ended — the page as it settles — and every loop held at its start. The
 * space's own motion is held by `MOTION_STILL_CSS`; another site's, or one written by hand, ran on: a run's
 * comparisons caught the original's late arrivals mid-fade, and read them as changes (6% on an artist's page).
 * Self-contained — it is serialised.
 */
const endAnimations = (): void => {
  for (const animation of document.getAnimations()) {
    if (animation.effect?.getComputedTiming().iterations === Infinity) {
      animation.pause();
      animation.currentTime = 0;
    } else {
      // One with no end (an endless delay, a rate of 0) cannot be finished: it is left as it is, never the picture's end.
      try {
        animation.finish();
      } catch {
        animation.pause();
      }
    }
  }
};

/**
 * One page, pictured: the project's own (`origin` given — in the space's theme when one is asked for) or another site,
 * in the scheme it is told.
 */
export const pictureOf = async (
  browser: Browser,
  url: string,
  view: View,
  origin?: string
): Promise<Taken | { problem: string }> => {
  // A members' page read as the project's account from the start, as every page command reads it (`visit.ts`).
  const account =
    view.account ?? (origin && view.membersAt?.(new URL(url).pathname) === true ? view.projectAccount : undefined);
  // The project's page made ready as a visitor's (`visit.ts`); another site's opened as it is, its own browser.
  const visit = origin
    ? await prepareVisit(
        browser,
        origin,
        {
          width: view.width,
          height: view.height,
          reducedMotion: view.reducedMotion,
          ...(view.scheme ? { scheme: view.scheme } : {}),
          ...(view.scale ? { scale: view.scale } : {}),
          ...(view.presence ? { presence: true } : {}),
          ...(view.timezone ? { timezone: view.timezone } : {}),
          ...(view.conditions ? { conditions: view.conditions } : {}),
          ...(view.standIns ? { standIns: true } : {})
        },
        account
      )
    : {
        page: await openOtherPage(browser, {
          viewport: { width: view.width, height: view.height },
          colorScheme: view.scheme ?? 'light',
          reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference',
          ...(view.timezone ? { timezoneId: view.timezone } : {}),
          ...(view.scale ? { deviceScaleFactor: view.scale } : {})
        })
      };
  const { page } = visit;
  if ('problem' in visit && visit.problem !== undefined) {
    return { problem: `${visit.problem}.` };
  }

  // Settled, not `networkidle`: a page with a live channel keeps its stream open, and never idles. From the load, the
  // first picture is taken once the HTML is in — what plays as the page arrives has ended by the time it settles.
  const open = (): Promise<unknown> =>
    view.fromLoad
      ? page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null)
      : openPage(page, url, origin ? projectSettling(page) : {});
  // Another site may be slow to wake (a cold CDN): asked again once before it is said not to answer.
  const answered = (await open()) ?? (origin ? null : await open());
  if (!answered) {
    return {
      problem: origin
        ? `Nothing answers at ${url}. Start the project first: ${projectRun('start')}`
        : `${url} did not answer — asked twice, 30 s each: a site warming up answers on the next try, run it again`
    };
  }

  const signed =
    origin && !account ? await signInWhereSent(page, origin, new URL(url).pathname, view.projectAccount) : undefined;
  if (signed && 'problem' in signed) {
    return signed;
  }

  if (signed) {
    saySignedIn(new URL(url).pathname, signed);
  }

  const sentTo = origin ? sentElsewhere(page, new URL(url).pathname) : undefined;

  for (const target of [view.waitFor, view.scrollTo, view.clip]) {
    const read = target === undefined ? undefined : await targetOn(page, target);
    if (read && 'problem' in read) {
      return read;
    }
  }

  if (view.waitFor) {
    const found = await page.waitForSelector(awaited(view.waitFor), { timeout: 10_000 }).catch(() => null);
    if (!found) {
      return { problem: `${view.waitFor} did not appear on ${url} within 10 s.` };
    }
  }

  /** The element a target names, once it is there: what it is scrolled to, or pictured alone. */
  const shown: Record<string, string> = {};
  let later: string | undefined;
  for (const target of [view.scrollTo, view.clip]) {
    if (target === undefined) {
      continue;
    }

    // A clip a click opens is not there yet: found as each picture after it is taken.
    const wait = view.clipLater === true && target === view.clip ? 1_500 : 10_000;
    const there = await page.waitForSelector(awaited(target), { timeout: wait }).catch(() => null);
    const read = there ? await targetOn(page, target) : undefined;
    // On the page and hidden — an answer a click opens — is not there to picture yet either.
    const hidden =
      view.clipLater === true &&
      target === view.clip &&
      read !== undefined &&
      !('problem' in read) &&
      read.found &&
      !(await page.locator(read.selector).first().isVisible());
    if (!read || 'problem' in read || !read.found || hidden) {
      if (view.clipLater === true && target === view.clip) {
        later = target;
        continue;
      }

      return {
        problem: `${target} is not on ${url} — not drawn there: hidden by its \`visible\` or a \`when\` (data a play makes: --steps), opened by a click (--click), for signed-in visitors (--as), or on another page (plitzi page outline <path> lists what is drawn).`
      };
    }

    shown[target] = read.selector;
  }

  // A component drawn in several states, its part named: the copy that shows what was asked for, not the first — a
  // run's look pictured a playing room card for a task that changed the idle one.
  const clipped = view.clip === undefined ? undefined : shown[view.clip];
  if (clipped !== undefined && view.showing && view.showing.length > 0) {
    const most = await page.evaluate(mostShowingInPage, { selector: clipped, ids: view.showing }).catch(() => 0);
    if (most > 0) {
      shown[view.clip ?? ''] = `${clipped} >> nth=${String(most)}`;
    }
  }

  // A page drawn as a screen is pictured as one: unrolled, its panes' scroll read as the page spilling over.
  const screen = await page.evaluate(lockedScreen, undefined);
  const how: Framing =
    later !== undefined
      ? { kind: 'element-later', target: later }
      : framing(
          { ...view, ...(screen === undefined ? {} : { viewport: true }) },
          view.clip === undefined ? undefined : shown[view.clip]
        );

  // Counted before the walk below, which shows every one of them.
  const settled = view.still
    ? await page.evaluate((selector: string) => document.querySelectorAll(selector).length, WAITING_FOR_SCROLL)
    : 0;
  // A page is taken without scrolling: a lazy picture below the fold would be a hole, and an arrival waiting for the
  // scroll would be one too — in a clip as in the whole page (a section's photo, lazy, read as none).
  // Loaded, unrolled (the SDK scrolls a pane of its own, which a full-page picture cannot extend) and held at its end,
  // the page is what a reader scrolling down ends up seeing.
  const whole = how.kind === 'page';
  const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(page.url());
  const pictures = await page.evaluate(loadImages, local ? IMAGES_BUDGET_MS : REMOTE_IMAGES_BUDGET_MS);
  if (whole) {
    await page.evaluate(unrollPage, undefined);
    // Back at its top, the document's and any pane's: the walk that loads its pictures, or a link the page followed to
    // an anchor, left it scrolled — a run's t-match pictured from mid-page, not from the hero it was about.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      for (const pane of Array.from(document.querySelectorAll('*'))) {
        if (pane.scrollTop > 0) {
          pane.scrollTop = 0;
        }
      }
    }, undefined);
  }

  // Scrolled to once its pictures are loaded: the walk that loads them leaves the page where it ended, and the
  // viewport pictured the top (a run's design-1, `--scroll-to … --viewport`).
  if (view.scrollTo) {
    await page.locator(shown[view.scrollTo]).first().scrollIntoViewIfNeeded();
  }

  if (view.still) {
    await page.addStyleTag({ content: MOTION_STILL_CSS });
    await page.evaluate(endAnimations, undefined);
  }

  const drawn = await canvasDrawn(page);

  return {
    page,
    how,
    png: await capture(page, how),
    ...(drawn ? {} : { canvasMoving: true as const }),
    scheme: await paintedScheme(page, view.scheme ?? 'light'),
    settled,
    unloaded: pictures.missing + pictures.embedsMissing,
    undrawn: pictures.embedsUndrawn,
    ...(sentTo ? { sentTo } : {}),
    ...(screen !== undefined && how.kind === 'viewport' && !view.viewport && !view.scrollTo ? { screen } : {})
  };
};
