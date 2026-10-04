export interface LoadedImages {
  /** The pictures the page has. */
  images: number;
  /** Those still not drawn when the budget ran out — or that failed. */
  missing: number;
}

/**
 * Runs in the page: every picture fetched and decoded before a picture of the whole page is taken. Self-contained — it
 * is serialised.
 *
 * A picture of the page is taken without scrolling, and a lazy image is fetched only once it is near the screen: below
 * the fold it is a hole, and a comparison counts the hole. So the page's scroller is walked down once — a loader of a
 * site's own (one that swaps `data-src` from an `IntersectionObserver`) and an arrival waiting to be seen react to the
 * scroll, not to an attribute — and back up; then `loading="lazy"` is made eager and the pictures are awaited, in
 * rounds while loading one turns up another (a blurred placeholder swapped for its picture), for `budgetMs` at most.
 */
export const loadImages = async (budgetMs: number): Promise<LoadedImages> => {
  const deadline = Date.now() + budgetMs;
  const left = (): number => Math.max(0, deadline - Date.now());
  const capped = (promise: Promise<unknown>): Promise<unknown> =>
    Promise.race([promise, new Promise(resolve => setTimeout(resolve, left()))]);
  // Two painted frames — an observer fires on the next one — or 100 ms where frames do not run.
  const frame = (): Promise<unknown> =>
    Promise.race([
      new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      new Promise(resolve => setTimeout(resolve, 100))
    ]);

  // The page scrolls the document, or a pane of its own: the SDK scrolls one inside `.plitzi-sdk`.
  const panes = Array.from(document.querySelectorAll('*')).filter(
    element => element.scrollHeight > element.clientHeight + 1 && element.clientHeight > 0
  );
  const scroller = panes.sort((a, b) => b.scrollHeight - a.scrollHeight).at(0) ?? document.scrollingElement;
  if (scroller) {
    const step = Math.max(scroller.clientHeight * 0.9, 200);
    for (let top = step; top < scroller.scrollHeight && left() > 0; top += step) {
      scroller.scrollTop = top;
      await frame();
    }

    scroller.scrollTop = 0;
    await frame();
  }

  for (let round = 0; round < 4 && left() > 0; round += 1) {
    const pending = Array.from(document.images).filter(image => {
      if (image.loading === 'lazy') {
        image.loading = 'eager';
      }

      return !image.complete;
    });
    if (round > 0 && pending.length === 0) {
      break;
    }

    await capped(Promise.all(pending.map(image => image.decode().catch(() => undefined))));
    await frame();
  }

  const images = Array.from(document.images);

  return {
    images: images.length,
    missing: images.filter(image => !image.complete || image.naturalWidth === 0).length
  };
};

/**
 * Runs in the page: the document made as tall as what it holds, so a picture of the whole page is the whole page.
 * Self-contained — it is serialised.
 *
 * The SDK renders into `.plitzi-sdk` with a column of its own that scrolls, so the document never does and a driver's
 * full-page picture has nothing to extend: it is one screen. The column that scrolls, and every element up to `<html>`,
 * stops clipping and stops being held to a height. The viewport is left as it is on purpose: grown to the content, every
 * `vh` would mean that height and a `100vh` hero would be thousands of pixels tall. Answers the document's height.
 */
export const unrollPage = (): number => {
  const panes = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
    element => element.scrollHeight > element.clientHeight + 1 && element.clientHeight > 0
  );
  const scroller = panes.sort((a, b) => b.scrollHeight - a.scrollHeight).at(0);
  for (let element: HTMLElement | null = scroller ?? null; element; element = element.parentElement) {
    element.style.setProperty('overflow', 'visible', 'important');
    element.style.setProperty('height', 'auto', 'important');
    element.style.setProperty('max-height', 'none', 'important');
  }

  return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
};
