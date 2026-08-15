import { test as base } from '@playwright/test';

import { isOpen, isSelected, skipReason, target } from '../targets';
import { createCapture } from './capture';
import { assertNoPageErrors, watchForPageErrors } from './consoleGuard';
import { createStep } from './step';

import type { Capture } from './capture';
import type { Step } from './step';
import type { Target } from '../targets';

export type PlitziFixtures = {
  /** Console output this spec accepts on purpose. Empty means none is accepted. */
  allowedConsoleErrors: RegExp[];
  /** Runs for every spec. Yields what the page has reported so far, for the rare spec that wants to assert on it
   *  rather than simply be failed by it. */
  pageErrorGuard: string[];
  /** Writes a PNG to a predictable path and attaches it to the report. */
  capture: Capture;
  /** A named step that captures the page when it finishes — one entry in the UI timeline, one numbered PNG on
   *  disk. Use it for anything a person would want to LOOK at, not just assert on. */
  step: Step;
};

export const test = base.extend<PlitziFixtures>({
  allowedConsoleErrors: [[], { option: true }],

  pageErrorGuard: [
    async ({ page, allowedConsoleErrors }, use, testInfo) => {
      const problems = watchForPageErrors(page, allowedConsoleErrors);

      await use(problems);

      assertNoPageErrors(problems, testInfo);
    },
    { auto: true }
  ],

  capture: async ({ page }, use, testInfo) => {
    await use(await createCapture(page, testInfo));
  },

  step: async ({ capture }, use) => {
    await use(createStep(capture));
  }
});

export { expect } from '@playwright/test';

/** Groups a spec under the target it exercises, and skips the whole group — with the reason, phrased as the thing
 *  to do about it — when that target was not booted: either it needs something this machine has not been given, or
 *  the run was narrowed to other targets. */
export const describeTarget = (id: string, define: (subject: Target) => void): void => {
  const subject = target(id);

  test.describe(subject.id, () => {
    test.skip(!isOpen(subject) || !isSelected(subject), skipReason(subject));

    define(subject);
  });
};
