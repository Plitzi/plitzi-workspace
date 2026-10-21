import { loadImages, openPage, unrollPage } from '@plitzi/sdk-authoring';
import { MOTION_STILL_CSS } from '@plitzi/sdk-shared/schema';

import { openProjectPage, paintedScheme, withoutDevTools } from '../../browser';
import { sentElsewhere, signInAs } from '../check';
import { BARE, IMAGES_BUDGET_MS, WAITING_FOR_SCROLL } from './types';

import type { Framing, Taken, View } from './types';
import type { Browser, BrowserPage } from '../../browser';

/**
 * A picture taken: of the page, the viewport or one element, once what it waits for has arrived.
 */

/** A bare word: an element's name — letters, digits, `-` and `_`, as an id is written — or else a tag (`textarea`). */
const namedBy = (target: string): string => `[data-plitzi-el="${target}"]`;

/** What a wait waits for: an element by name or, a bare word naming none, a tag — whichever shows first. */
export const awaited = (target: string): string => (BARE.test(target) ? `${namedBy(target)}, ${target}` : target);

/**
 * A target found on the page: an element's name, a tag no element is named by (`textarea`), or a selector — CSS or
 * Playwright's own (`button:has-text("Orbit")`, `text=Saved`, `role=button[name="Publish"]`). With how many it finds
 * (none is one not on the page), or why it is no selector at all: Playwright throws on one it cannot read, and an
 * uncaught throw ended the command with a stack trace.
 */
export const targetOn = async (
  page: BrowserPage,
  target: string
): Promise<{ selector: string; found: boolean } | { problem: string }> => {
  try {
    if (!BARE.test(target)) {
      return { selector: target, found: (await page.locator(target).first().count()) > 0 };
    }

    if ((await page.locator(namedBy(target)).first().count()) > 0) {
      return { selector: namedBy(target), found: true };
    }

    return (await page.locator(target).first().count()) > 0
      ? { selector: target, found: true }
      : { selector: namedBy(target), found: false };
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

export const capture = (page: BrowserPage, how: Framing): Promise<Uint8Array> => {
  if (how.kind === 'element') {
    return page.locator(how.selector).first().screenshot();
  }

  return page.screenshot({ fullPage: how.kind === 'page' });
};

/**
 * One page, pictured: the project's own (`origin` given — in the space's theme when one is asked for) or another site,
 * in the scheme it is told.
 */
/**
 * Runs in the page: every animation that ends, ended — the page as it settles — and every loop held at its start. The
 * space's own motion is held by `MOTION_STILL_CSS`; another site's, or one written by hand, ran on: velada-now's
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

export const pictureOf = async (
  browser: Browser,
  url: string,
  view: View,
  origin?: string
): Promise<Taken | { problem: string }> => {
  const page = origin
    ? await openProjectPage(browser, origin, view)
    : await browser.newPage({
        viewport: { width: view.width, height: view.height },
        colorScheme: view.scheme ?? 'light',
        reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference'
      });
  const notSignedIn = origin && view.account && (await signInAs(page, origin, view.account));
  if (notSignedIn) {
    return { problem: `--as ${notSignedIn}.` };
  }

  // Settled, not `networkidle`: a page with a live channel keeps its stream open, and never idles. From the load, the
  // first picture is taken once the HTML is in — what plays as the page arrives has ended by the time it settles.
  const open = (): Promise<unknown> =>
    view.fromLoad ? page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null) : openPage(page, url);
  // Another site may be slow to wake (a cold CDN): asked again once before it is said not to answer.
  const answered = (await open()) ?? (origin ? null : await open());
  if (!answered) {
    return {
      problem: origin
        ? `Nothing answers at ${url}. Start the project first: npm start`
        : `${url} did not answer — asked twice, 30 s each: a site warming up answers on the next try, run it again`
    };
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
  for (const target of [view.scrollTo, view.clip]) {
    if (target === undefined) {
      continue;
    }

    const there = await page.waitForSelector(awaited(target), { timeout: 10_000 }).catch(() => null);
    const read = there ? await targetOn(page, target) : undefined;
    if (!read || 'problem' in read || !read.found) {
      return { problem: `${target} is not on ${url}.` };
    }

    shown[target] = read.selector;
  }

  if (view.scrollTo) {
    await page.locator(shown[view.scrollTo]).first().scrollIntoViewIfNeeded();
  }

  const how = framing(view, view.clip === undefined ? undefined : shown[view.clip]);

  await withoutDevTools(page);
  // Counted before the walk below, which shows every one of them.
  const settled = view.still
    ? await page.evaluate((selector: string) => document.querySelectorAll(selector).length, WAITING_FOR_SCROLL)
    : 0;
  // A whole page is taken without scrolling: a lazy picture below the fold would be a hole, and an arrival waiting
  // for the scroll would be one too. Loaded, unrolled (the SDK scrolls a pane of its own, which a full-page picture
  // cannot extend) and held at its end, the page is what a reader scrolling down ends up seeing.
  const whole = how.kind === 'page';
  const pictures = whole ? await page.evaluate(loadImages, IMAGES_BUDGET_MS) : undefined;
  if (whole) {
    await page.evaluate(unrollPage, undefined);
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
    unloaded: (pictures?.missing ?? 0) + (pictures?.embedsMissing ?? 0),
    undrawn: pictures?.embedsUndrawn ?? [],
    ...(sentTo ? { sentTo } : {})
  };
};
