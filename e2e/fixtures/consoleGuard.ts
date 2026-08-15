import { expect } from '@playwright/test';

import type { Page, TestInfo } from '@playwright/test';

/** A page that renders the right DOM while throwing in the console is not a page that works. React swallows a
 *  failing effect into a console error and keeps the last good tree on screen, which is exactly the class of bug
 *  a unit test never sees and a screenshot never shows — so every spec fails on one unless it says otherwise.
 *
 *  Opt out per spec with `test.use({ allowedConsoleErrors: [/pattern/] })`, and only for noise you have read. */
export const watchForPageErrors = (page: Page, allowed: RegExp[]): string[] => {
  const problems: string[] = [];

  const record = (entry: string) => {
    if (!allowed.some(pattern => pattern.test(entry))) {
      problems.push(entry);
    }
  };

  page.on('console', message => {
    if (message.type() === 'error') {
      record(`console.error: ${message.text()}`);
    }
  });

  page.on('pageerror', error => {
    record(`pageerror: ${error.message}`);
  });

  return problems;
};

/** Reported only when the test would otherwise have passed. A spec that already failed has its own reason, and
 *  burying it under the console noise that failure caused helps nobody. */
export const assertNoPageErrors = (problems: string[], testInfo: TestInfo): void => {
  if (testInfo.errors.length) {
    return;
  }

  expect(problems, 'the page reported errors while rendering').toEqual([]);
};
