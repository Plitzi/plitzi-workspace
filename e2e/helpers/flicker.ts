import type { Page } from '@playwright/test';

/**
 * Watches what a page PAINTS, frame by frame.
 *
 * A flicker is not a state the DOM passed through — React passes through plenty of those between one commit and
 * the next, and the browser never shows them. It is a state the browser actually painted, so this samples once
 * per animation frame and reports the frames a selector was on screen in. What a spec then asserts is that a
 * thing which must not be there was never painted at all, and that a thing which was on screen did not vanish.
 *
 * Installed before the document loads, so the very first paint is in the record too.
 */
export type PaintTrace = { selector: string; frames: number; firstAt: number; lastAt: number }[];

type Sample = { t: number; counts: Record<string, number> };

declare global {
  interface Window {
    __paintSamples?: Sample[];
  }
}

export const watchPaint = async (page: Page, selectors: string[]): Promise<void> => {
  await page.addInitScript(watched => {
    window.__paintSamples = [];
    // A selector the browser cannot parse throws, and a throw here would kill the loop and report a page with no
    // flicker because nothing was ever sampled. Playwright's own pseudo-classes (`:has-text`) are the way that
    // happens, so it is answered with -1 — a spec asserting on a count sees a number that cannot pass.
    const visible = (selector: string) => {
      try {
        return [...document.querySelectorAll(selector)].filter(node => {
          const element = node as HTMLElement;

          return element.offsetParent !== null || element.getClientRects().length > 0;
        }).length;
      } catch {
        return -1;
      }
    };

    const tick = () => {
      const counts: Record<string, number> = {};
      for (const selector of watched) {
        counts[selector] = visible(selector);
      }

      window.__paintSamples?.push({ t: Math.round(performance.now()), counts });
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, selectors);
};

/** Starts a fresh window, so a spec can measure one navigation rather than everything since the page loaded. */
export const resetPaint = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.__paintSamples = [];
  });
};

/** How many painted frames each selector appeared in, and when. */
export const paintTrace = async (page: Page, selectors: string[]): Promise<PaintTrace> => {
  const samples = await page.evaluate(() => window.__paintSamples ?? []);

  return selectors.map(selector => {
    const seen = samples.filter(sample => (sample.counts[selector] ?? 0) > 0);
    if (samples.some(sample => sample.counts[selector] === -1)) {
      throw new Error(`"${selector}" is not a selector the browser can parse — the sampler runs CSS, not Playwright`);
    }


    return {
      selector,
      frames: seen.length,
      firstAt: seen[0]?.t ?? -1,
      lastAt: seen[seen.length - 1]?.t ?? -1
    };
  });
};

/** The selectors that were painted at least once — what a spec asserts against. */
export const painted = async (page: Page, selectors: string[]): Promise<string[]> =>
  (await paintTrace(page, selectors)).filter(entry => entry.frames > 0).map(entry => entry.selector);
