import { test as base } from '@playwright/test';

import type { Capture } from './capture';

/** A named step that leaves a picture behind.
 *
 *  Two things come out of wrapping work this way. In Playwright's UI the step appears as its own entry in the
 *  timeline, so stepping through a test reads as the journey it is rather than as forty anonymous actions. And on
 *  disk it leaves a numbered PNG, so the whole run can be reviewed without the UI at all — which is the only way
 *  to catch a page that renders, passes every assertion, and looks wrong.
 *
 *  Numbered in execution order, so the files sort the way the test ran. */
export type Step = (name: string, body: () => Promise<void>) => Promise<void>;

export const createStep = (capture: Capture): Step => {
  let index = 0;

  return async (name, body) => {
    index += 1;
    const label = `${String(index).padStart(2, '0')}-${name}`;

    await base.step(name, async () => {
      await body();
      await capture(label);
    });
  };
};
