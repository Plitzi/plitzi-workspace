import { expect } from '@playwright/test';

import { inspectDocument } from '@plitzi/sdk-authoring';

import type { Page } from '@playwright/test';

/** Breakage that only a browser can see, on a page whose space is not in hand — an example served by its own server.
 *  Images that never arrived (an image element's fallback included), a page that scrolls sideways, text drawn in the
 *  colour behind it. None needs a baseline image: they are properties a laid-out page either has or does not, so they
 *  mean the same thing on any machine and fail with a sentence instead of a diff.
 *
 *  With the space in hand, `expectPageWhole` in `./harness` does all of this and every element it owes as well. */
export const expectVisuallyHealthy = async (page: Page): Promise<void> => {
  expect((await inspectDocument(page)).problems).toEqual([]);
};
