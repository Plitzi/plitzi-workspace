import { test } from '@playwright/test';

import { warmUpDevServers } from './warmUp';

/** The setup project every category depends on. Written with Playwright's own `test` rather than the suite's, on
 *  purpose: the fixtures fail a test on any console error, and absorbing exactly those errors is what this is for.
 *
 *  It shows up in the UI as a step of its own, so the wait is legible instead of looking like a hang. */
test('dev servers have crawled their dependencies', async () => {
  test.setTimeout(300_000);

  await warmUpDevServers();
});
