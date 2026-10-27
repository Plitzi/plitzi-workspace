import { openPage } from '@plitzi/sdk-authoring';

import { pictureOf } from './capture';
import { openOtherPage, openOtherPageIn } from '../../../browser';

import type { Taken, View } from './types';
import type { Browser, BrowserContext, BrowserPage } from '../../../browser';

/** What a page its site never answered is said as — asked once more, after `ANSWER_AGAIN_MS`. */
const NOT_ANSWERED = 'did not answer';

const ANSWER_AGAIN_MS = 2_000;

/** How long to wait before each try again of a page its site turned away as busy. */
const RETRY_AFTER_MS = [10_000, 30_000];

/** The status the page's own document came with: what tells a page from an error a site answered in its place. */
const documentStatus = (): number => {
  const navigation = performance.getEntriesByType('navigation').at(0);
  const status: unknown = navigation ? Reflect.get(navigation, 'responseStatus') : undefined;

  return typeof status === 'number' ? status : 0;
};

/**
 * A page of another site, taken by `take` once its site answers it — never its error page kept as the page: a run's
 * original answered its fighters' list with "You are being rate limited". A site that says it is busy (429, 503) is
 * asked again, later; any other error is said.
 */
const whenAnswered = async <T extends { page: BrowserPage }>(
  take: () => Promise<T | { problem: string }>,
  failed: string
): Promise<(T & { notFound?: true }) | { problem: string }> => {
  for (let attempt = 0; ; attempt += 1) {
    // A page the browser gave up on (a font that never loaded, a page still busy) is this page's failure, asked once
    // more — never the end of every page after it: a run's original timed one out, and the command crashed.
    const taken = await take().catch(
      (error: unknown) =>
        ({ problem: `${failed}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` }) as const
    );
    if ('problem' in taken) {
      // …and one it never answered, once more after a moment: a run's original "did not answer" at 1440 now and
      // then, and the same call answered at 390.
      if (attempt === 0 && (taken.problem.startsWith(failed) || taken.problem.endsWith(NOT_ANSWERED))) {
        await new Promise(resolve => setTimeout(resolve, ANSWER_AGAIN_MS));
        continue;
      }

      return taken;
    }

    const status = await taken.page.evaluate(documentStatus, undefined);
    if (status < 400) {
      return taken;
    }

    // An address nothing answers is a page of its own — the site's 404, which a copy makes too (a run's "Elige a
    // tu boxeador"): kept, and said so, never refused as an error page.
    if (status === 404) {
      return { ...taken, notFound: true };
    }

    await taken.page.close();
    const wait = RETRY_AFTER_MS.at(attempt);
    if ((status !== 429 && status !== 503) || wait === undefined) {
      return {
        problem: `the site answered ${String(status)}${status === 429 ? ' (asked too often) — keep it again later' : ''}`
      };
    }

    await new Promise(resolve => setTimeout(resolve, wait));
  }
};

/** A page of the reference, pictured once its site answers it. */
export const pictureAnswered = (
  browser: Browser,
  url: string,
  view: View
): Promise<(Taken & { notFound?: true }) | { problem: string }> =>
  whenAnswered(() => pictureOf(browser, url, view), 'the picture was not taken');

/**
 * The other side's address for one of ours: a site named by its root (`--compare https://example.com`) answers each of
 * our paths at the same path; an address with a path of its own is that page, whatever ours is.
 */
export const otherPageAt = (pathname: string, compare: string): string => {
  const other = new URL(compare);

  return other.pathname === '/' ? new URL(pathname, other).href : other.href;
};

/**
 * A page of another site open to be read, once its site answers it — no picture taken: what `page measure` reads is
 * styles, and a whole-page picture (its pictures loaded, the page unrolled) was most of its 18 s a call.
 */
export const pageAnswered = (
  browser: Browser,
  url: string,
  view: Pick<View, 'width' | 'height' | 'scheme' | 'reducedMotion' | 'timezone'>,
  /** A context shared with other pages, the kept browser's: the site loads warm. A time zone is a context's own. */
  shared?: BrowserContext
): Promise<({ page: BrowserPage } & { notFound?: true }) | { problem: string }> =>
  whenAnswered(async () => {
    const page =
      shared && !view.timezone
        ? await openOtherPageIn(browser, shared, view)
        : await openOtherPage(browser, {
            viewport: { width: view.width, height: view.height },
            colorScheme: view.scheme ?? 'light',
            reducedMotion: view.reducedMotion ? 'reduce' : 'no-preference',
            ...(view.timezone ? { timezoneId: view.timezone } : {})
          });
    if (!(await openPage(page, url).catch(() => null))) {
      await page.close();

      return { problem: `${url} ${NOT_ANSWERED}` };
    }

    // Sizes are read in the fonts the page asked for, never its fallback's.
    await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

    return { page };
  }, 'the page was not read');
