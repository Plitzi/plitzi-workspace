import { describeTarget, expect, isMockBackend, test } from '../../fixtures';

import type { Page } from '@playwright/test';

/**
 * A builder that cannot open its space says why and where to go. It drew the bare words of the error — "Authentication
 * required" — on an empty page, with no way back and no way to sign in again.
 */
describeTarget('builder', subject => {
  /** The space's load answered as `answer` does, in front of the suite's mocked backend. */
  const failInit = async (page: Page, answer: 'refused' | 'missing' | 'down') => {
    await page.route(
      url => url.pathname === '/' && /server\./.test(url.host),
      async route => {
        const body = route.request().postData() ?? '';
        if (route.request().method() !== 'POST' || !body.includes('"operationName":"InitQuery"')) {
          await route.fallback();

          return;
        }

        if (answer === 'down') {
          await route.abort('failed');

          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(
            answer === 'refused'
              ? { errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }] }
              : { data: { Space: null } }
          )
        });
      }
    );
  };

  // The unreachable case is made by refusing the request: the browser says so in the console, as it should.
  test.use({ allowedConsoleErrors: [/Failed to load resource: net::ERR_FAILED/] });

  for (const [answer, title, action] of [
    ['refused', 'Your session has ended', 'Sign in again'],
    ['missing', 'This space is not one you can open', 'Back to your spaces'],
    ['down', 'The builder cannot reach Plitzi', 'Try again']
  ] as const) {
    test(`says why it cannot open the space, and the way out, when the server ${answer === 'down' ? 'is unreachable' : `answers it ${answer}`}`, async ({
      page
    }) => {
      test.skip(!isMockBackend(), 'the failure is the mock’s to answer');
      await failInit(page, answer);
      await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });

      const refusal = page.getByRole('alert').filter({ hasText: title });
      await expect(refusal).toContainText(title, { timeout: 60_000 });
      await expect(refusal.getByRole('button', { name: action })).toBeVisible();
      await expect(refusal.getByRole('button', { name: 'Back to your spaces' })).toBeVisible();
    });
  }
});
