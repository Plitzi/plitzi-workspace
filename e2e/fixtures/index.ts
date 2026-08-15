import { test as base } from '@playwright/test';

import { isCiRun, isMockBackend } from '../backend';
import { defaultMockSpace, mockBackend } from '../mock';
import { isOpen, isSelected, skipReason, target } from '../targets';
import { createCapture } from './capture';
import { assertNoPageErrors, watchForPageErrors } from './consoleGuard';
import { stubExternalRequests } from './offlineNetwork';
import { createStep } from './step';

import type { Capture } from './capture';
import type { Step } from './step';
import type { Target } from '../targets';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

export type PlitziFixtures = {
  /** Console output this spec accepts on purpose. Empty means none is accepted. */
  allowedConsoleErrors: RegExp[];
  /** Runs for every spec. Yields what the page has reported so far, for the rare spec that wants to assert on it
   *  rather than simply be failed by it. */
  pageErrorGuard: string[];
  /** Runs for every spec: answers requests that would leave this machine, so no run depends on somebody else's
   *  CDN being up. */
  offlineNetwork: string;
  /** The space a mocked backend serves this spec. Override per test — the smallest space that can still show
   *  what the test is about: `test.use({ mockSpace: minimalSpace() })`. */
  mockSpace: OfflineDataRaw;
  /** Writes a PNG to a predictable path and attaches it to the report. */
  capture: Capture;
  /** A named step that captures the page when it finishes — one entry in the UI timeline, one numbered PNG on
   *  disk. Use it for anything a person would want to LOOK at, not just assert on. */
  step: Step;
};

export const test = base.extend<PlitziFixtures>({
  allowedConsoleErrors: [[], { option: true }],

  mockSpace: [defaultMockSpace(), { option: true }],

  pageErrorGuard: [
    async ({ page, allowedConsoleErrors }, use, testInfo) => {
      const problems = watchForPageErrors(page, allowedConsoleErrors);

      await use(problems);

      assertNoPageErrors(problems, testInfo);
    },
    { auto: true }
  ],

  offlineNetwork: [
    async ({ page, mockSpace }, use) => {
      await stubExternalRequests(page);

      // After the blanket stub, so it takes precedence: Playwright matches routes in reverse registration order.
      if (isMockBackend()) {
        await mockBackend(page, mockSpace);
      }

      await use(isMockBackend() ? 'stubbed+mocked' : 'stubbed');
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

/** Declares that what follows only means something against a real server, so a mocked run skips it instead of
 *  passing vacuously. Put it at the top of a spec, or inside one `test.describe`.
 *
 *  Use it for anything whose subject is the SERVER: what it persists, what it refuses, the shape of what it
 *  returns. A spec about how the app renders and reacts belongs in both modes and needs none of this. */
export const onlyLiveBackend = (reason = 'the subject is the server, not the page'): void => {
  test.skip(isMockBackend(), `needs a live backend — ${reason}. Drop PLITZI_CI and bring the stack up.`);
};

/** Whether this is a CI run, for a spec that legitimately behaves differently. */
export { isCiRun, isMockBackend };

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
