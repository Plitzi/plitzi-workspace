import { describeTarget, expect, test } from '../../../fixtures';
import { CREDENTIALS } from '../../../server/accounts';
import { AUTH_PROBE, authSpace, PROBE_PATH } from '../../../spaces/auth';

import type { Page } from '@playwright/test';

/**
 * What the query cache does when the person the page is for changes.
 *
 * Forgetting is the point — a request authenticated by a cookie carries nothing that tells two visitors apart, so an
 * answer held for one must never be served to the next. Asking again afterwards is a separate decision, and both
 * ways of getting it wrong were shipped:
 *
 * - **Signing out asked again**, as nobody. Every provider still on screen answered 401, and every 401 is reported
 *   as a session that has ended — for a page already on its way to the guest view.
 * The other half of it — a sign-in asking for the account area twice, because forgetting from a passive effect
 * lands after the page that just mounted has already asked — needs the two to fall in one commit, and in a space
 * this small the account area mounts later regardless. `useSessionQueryReset`'s own test pins that ordering instead.
 *
 * Counted at the network, because the screen looks the same either way.
 */

const { editor } = CREDENTIALS;

/** Every request for a probe, and every refusal, from the moment this is called. */
const watchProbes = (page: Page) => {
  const asked: string[] = [];
  const refused: string[] = [];
  page.on('request', request => {
    if (request.url().includes(PROBE_PATH)) {
      asked.push(new URL(request.url()).pathname);
    }
  });
  page.on('response', response => {
    if (response.status() === 401) {
      refused.push(new URL(response.url()).pathname);
    }
  });

  return { asked, refused };
};

const signIn = async (page: Page) => {
  await page.getByLabel('Username').fill(editor.username);
  await page.getByLabel('Password').fill(editor.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

describeTarget('auth-server', subject => {
  test('signing out asks for nothing, and is refused nothing', async ({ page }) => {
    await page.goto(`${subject.origin}/login`);
    await signIn(page);
    await expect(page.getByRole('heading', { name: editor.username })).toBeVisible();

    // The one page with no access level at all: a sign-out leaves it, and its provider, exactly where they are.
    await page.goto(`${subject.origin}/always`);
    await expect(page.locator(authSpace().handles.element(AUTH_PROBE.alwaysTitle).selector)).toHaveText('always');

    const probes = watchProbes(page);
    await page.getByRole('button', { name: 'Sign out here' }).click();
    await expect(page.getByRole('button', { name: 'Sign out here' })).toBeVisible();
    await page.waitForTimeout(700);

    expect(probes.asked, 'a provider was asked for again with no session to ask with').toEqual([]);
    expect(probes.refused, 'something was refused after the sign-out').toEqual([]);
  });
});
