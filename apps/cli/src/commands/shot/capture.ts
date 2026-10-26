import { loadImages, openPage, unrollPage } from '@plitzi/sdk-authoring';
import { MOTION_STILL_CSS } from '@plitzi/sdk-shared/schema';

import { openOtherPage, openProjectPage, paintedScheme, PROJECT_QUIET_MS } from '../../browser';
import { saySignedIn, sentElsewhere, signInAs, signInWhereSent } from '../check';
import { BARE, IMAGES_BUDGET_MS, REMOTE_IMAGES_BUDGET_MS, WAITING_FOR_SCROLL } from './types';

import type { Framing, Taken, View } from './types';
import type { Browser, BrowserPage } from '../../browser';

/**
 * A picture taken: of the page, the viewport or one element, once what it waits for has arrived.
 */

/** A bare word: an element's name — letters, digits, `-` and `_`, as an id is written — or else a tag (`textarea`). */
const namedBy = (target: string): string => `[data-plitzi-el="${target}"]`;

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

    // A bare word: an element's name, a tag — or an id, as a section's anchor is (`--clip combates`) — or a component's
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

/** The attribute a pinned element hidden for an element's picture carries: its own visibility, put back after. */
export const HIDDEN_FOR_SHOT = 'data-plitzi-shot-hidden';

/**
 * Runs in the page: every element pinned to the screen (fixed or sticky) that is neither the target, inside it nor
 * around it, hidden — what is drawn over a part scrolled to the top of the screen, a site's sticky header over the
 * first rows of a run's queue in every clipped picture. Self-contained — it is serialised.
 */
export const hidePinned = (target: Element, attribute: string): number => {
  let hidden = 0;
  for (const element of document.querySelectorAll<HTMLElement>('body *')) {
    const { position } = getComputedStyle(element);
    if (
      (position === 'fixed' || position === 'sticky') &&
      !element.contains(target) &&
      !target.contains(element) &&
      !element.hasAttribute(attribute)
    ) {
      element.setAttribute(attribute, element.style.visibility);
      element.style.visibility = 'hidden';
      hidden += 1;
    }
  }

  return hidden;
};

/** Runs in the page: what `hidePinned` hid, shown again as it was. Self-contained — it is serialised. */
export const showPinned = (attribute: string): void => {
  for (const element of document.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    element.style.visibility = element.getAttribute(attribute) ?? '';
    element.removeAttribute(attribute);
  }
};

/** One element's picture, nothing pinned to the screen drawn over it. */
const elementShot = async (page: BrowserPage, selector: string): Promise<Uint8Array> => {
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
 * One page, pictured: the project's own (`origin` given — in the space's theme when one is asked for) or another site,
 * in the scheme it is told.
 */
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

/** One colour a picture's address always gets: the same picture the same on both sides, another one another. */
export const standIn = (url: string): string => {
  let hue = 7;
  for (let index = 0; index < url.length; index += 1) {
    hue = (hue * 31 + url.charCodeAt(index)) % 360;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${String(hue)} 35% 55%)"/></svg>`;
};

/** Every picture from another site than `origin`, answered by its stand-in (`View.standIns`). */
export const standInPictures = (page: BrowserPage, origin: string): Promise<void> =>
  page.route(
    url => url.origin !== origin,
    async route =>
      route.request().resourceType() === 'image'
        ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: standIn(route.request().url()) })
        : route.fallback()
  );

export const pictureOf = async (
  browser: Browser,
  url: string,
  view: View,
  origin?: string
): Promise<Taken | { problem: string }> => {
  const page = origin
    ? await openProjectPage(browser, origin, view)
    : await openOtherPage(browser, {
        viewport: { width: view.width, height: view.height },
        colorScheme: view.scheme ?? 'light',
        reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference',
        ...(view.timezone ? { timezoneId: view.timezone } : {}),
        ...(view.scale ? { deviceScaleFactor: view.scale } : {})
      });
  if (view.standIns && origin) {
    await standInPictures(page, origin);
  }

  const notSignedIn = origin && view.account && (await signInAs(page, origin, view.account));
  if (notSignedIn) {
    return { problem: `--as ${notSignedIn}.` };
  }

  // Settled, not `networkidle`: a page with a live channel keeps its stream open, and never idles. From the load, the
  // first picture is taken once the HTML is in — what plays as the page arrives has ended by the time it settles.
  const open = (): Promise<unknown> =>
    view.fromLoad
      ? page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null)
      : openPage(page, url, origin ? { quietMs: PROJECT_QUIET_MS } : {});
  // Another site may be slow to wake (a cold CDN): asked again once before it is said not to answer.
  const answered = (await open()) ?? (origin ? null : await open());
  if (!answered) {
    return {
      problem: origin
        ? `Nothing answers at ${url}. Start the project first: npm start`
        : `${url} did not answer — asked twice, 30 s each: a site warming up answers on the next try, run it again`
    };
  }

  const signed =
    origin && !view.account
      ? await signInWhereSent(page, origin, new URL(url).pathname, view.projectAccount)
      : undefined;
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

  const how: Framing =
    later !== undefined
      ? { kind: 'element-later', target: later }
      : framing(view, view.clip === undefined ? undefined : shown[view.clip]);

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

  return {
    page,
    how,
    png: await capture(page, how),
    scheme: await paintedScheme(page, view.scheme ?? 'light'),
    settled,
    unloaded: pictures.missing + pictures.embedsMissing,
    undrawn: pictures.embedsUndrawn,
    ...(sentTo ? { sentTo } : {})
  };
};
