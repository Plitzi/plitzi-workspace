import type { BrowserPage } from '../../browser';

/**
 * How long a space's page may take to take presses after it loads. A dev server compiles a page on its first request:
 * a run's clicks landed on a page that had not hydrated yet, did nothing, and what was read after them was said as
 * though they had (the wait was 10 s, and its end was swallowed).
 */
export const HYDRATION_MS = 30_000;

/** How long a page may take to show a space at all: none by then, and it is no space's page — nothing to wait for. */
const SPACE_MS = 10_000;

/**
 * Waits for the space on the page to take its markup over (`data-hydrated`, put on its root by the SDK) — or says it did
 * not: a press before then does nothing, and what is read is the server's HTML, not the page a visitor uses. A page with
 * no space on it has nothing to wait for; one that hydrated answers at once.
 */
export const awaitHydration = async (page: BrowserPage): Promise<string | undefined> => {
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
    : `the page had not hydrated ${String(HYDRATION_MS / 1000)} s after it loaded, so a press would do nothing and ` +
        `what is read is the server's HTML. A dev server compiling the page on its first request is the usual cause: ` +
        `run it again — still not hydrated, plitzi page check says what stops it`;
};
