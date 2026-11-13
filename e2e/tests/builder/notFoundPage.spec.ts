import { authorSpace, heading } from '@plitzi/sdk-authoring';

import { describeTarget, expect, isMockBackend, test } from '../../fixtures';

/**
 * The page for the addresses nothing answers, in the Pages tree: marked 404, and made of another page by its menu's "Use
 * as 404 page" — which gives the old one a slug of its own back, so there is never two in one place for the router to
 * pick between.
 */
const space = () =>
  authorSpace({
    name: 'Site',
    permanentUrl: 'site',
    pages: [
      { id: 'home', name: 'Home', slug: '', isDefault: true, body: [heading('Home', { id: 'home-title' })] },
      { id: 'lost', name: 'Lost', slug: '*', body: [heading('Lost', { id: 'lost-title' })] },
      { id: 'gone', name: 'Gone', slug: 'gone', body: [heading('Gone', { id: 'gone-title' })] }
    ]
  });

const NOT_FOUND = 'The 404 page: every address no other page answers lands here, sent with status 404';

describeTarget('builder', subject => {
  test.use({ mockSpace: space() });

  test('marks the 404 page, and makes another one it, giving the old one its own address back', async ({
    page,
    capture
  }) => {
    test.skip(!isMockBackend(), 'the live backend serves a space this spec knows nothing about');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
    const pages = page.getByRole('button', { name: 'Pages', exact: true });
    await expect(pages).toBeVisible({ timeout: 60_000 });
    if ((await pages.getAttribute('aria-pressed')) !== 'true') {
      await pages.click();
    }

    const badge = page.getByRole('img', { name: NOT_FOUND, exact: true });
    const row = (name: string) => page.locator('a').filter({ hasText: new RegExp(`^${name}`) });
    await expect(badge).toHaveCount(1);
    await expect(row('Lost').getByRole('img', { name: NOT_FOUND })).toBeVisible();
    await capture('lost-is-404');

    await row('Gone').hover();
    await row('Gone').getByRole('button', { name: 'Use as 404 page' }).click();
    await expect(page.getByText(/Lost.{1,2} the 404 page until now, gets the address .lost./)).toBeVisible();
    await page.getByRole('button', { name: 'Accept', exact: true }).click();

    await expect(row('Gone').getByRole('img', { name: NOT_FOUND })).toBeVisible();
    await expect(badge).toHaveCount(1);
    await capture('gone-is-404');
  });
});
