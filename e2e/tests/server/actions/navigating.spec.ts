import { describeTarget, expect, test } from '../../../fixtures';
import { ACTION_IDS } from '../../../spaces';

import type { Page } from '@playwright/test';

/**
 * A link to a page resolved on the server: its data is asked for before the route changes, and only once.
 *
 * Before, the route change that followed the prefetch asked again — every click cost the server two renders — and the
 * answers landed in whatever order they arrived, so a slow one could paint a page the visitor had already left.
 */
describeTarget('action-server', subject => {
  const byId = (page: Page, id: string) => page.locator(`[data-plitzi-el="${id}"]`);

  /** Every `/_rsc` request the page makes from here on, by the location it asks about. */
  const countRsc = (page: Page) => {
    const asked: string[] = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/_rsc') {
        asked.push(url.searchParams.get('location') ?? '');
      }
    });

    return asked;
  };

  test('a link asks the server for its destination once', async ({ page }) => {
    await page.goto(`${subject.origin}/navigate`);
    await expect(byId(page, ACTION_IDS.navWho)).toHaveText('everyone');
    const asked = countRsc(page);

    await byId(page, ACTION_IDS.navAna).click();

    await expect(byId(page, ACTION_IDS.navWho)).toHaveText('ana');
    await expect(page).toHaveURL(/\?who=ana$/);
    // Long enough for a second request — the route change's — to have gone out, had it been going to.
    await page.waitForTimeout(800);
    expect(asked).toEqual(['/navigate?who=ana']);
  });

  /** Two links clicked before the first answered: the page ends where the visitor ended, with that answer. */
  test('the last link clicked is the page that stays, with its own answer', async ({ page }) => {
    await page.goto(`${subject.origin}/navigate`);
    await expect(byId(page, ACTION_IDS.navWho)).toHaveText('everyone');

    await byId(page, ACTION_IDS.navAna).click();
    await byId(page, ACTION_IDS.navBob).click();

    await expect(byId(page, ACTION_IDS.navWho)).toHaveText('bob');
    await expect(page).toHaveURL(/\?who=bob$/);
    await page.waitForTimeout(800);
    await expect(byId(page, ACTION_IDS.navWho), 'an older answer landed over the newer one').toHaveText('bob');
    await expect(page).toHaveURL(/\?who=bob$/);
  });

  /** `navigation.pending` while the destination's data is on its way — what a loading bar binds to. */
  test('says a navigation is on its way while its data is', async ({ page }) => {
    await page.goto(`${subject.origin}/navigate`);
    await expect(byId(page, ACTION_IDS.navPending)).toHaveText('false');

    await byId(page, ACTION_IDS.navAna).click();

    await expect(byId(page, ACTION_IDS.navPending)).toHaveText('true');
    await expect(byId(page, ACTION_IDS.navPending)).toHaveText('false');
    await expect(byId(page, ACTION_IDS.navWho)).toHaveText('ana');
  });
});
