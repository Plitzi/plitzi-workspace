import { authorSpace, heading } from '@plitzi/sdk-authoring';

import { describeTarget, expect, isMockBackend, test } from '../../fixtures';

/**
 * The page tree marks what a visitor may not open: a lock beside a protected page, saying who it is for, and beside a
 * folder all of whose pages are — read by the rule the server withholds pages with, so the lock and what a visitor is
 * sent never disagree. Without it, which of a console's twenty pages a visitor signed out could open was a question
 * asked of each page's settings, one by one.
 */
const protectedSpace = () =>
  authorSpace({
    name: 'Console',
    permanentUrl: 'console',
    pageFolders: [{ id: 'console', name: 'Console' }],
    pages: [
      { id: 'home', name: 'Home', slug: '', isDefault: true, body: [heading('Home', { id: 'home-title' })] },
      {
        id: 'dashboard',
        name: 'Dashboard',
        slug: 'dashboard',
        folder: 'console',
        accessLevel: 'authenticated',
        body: [heading('Dashboard', { id: 'dashboard-title' })]
      },
      {
        id: 'billing',
        name: 'Billing',
        slug: 'billing',
        folder: 'console',
        access: { permissions: ['billing'] },
        body: [heading('Billing', { id: 'billing-title' })]
      }
    ]
  });

describeTarget('builder', subject => {
  test.use({ mockSpace: protectedSpace() });

  test('marks a protected page and a folder of them with a lock that says who they are for', async ({
    page,
    capture
  }) => {
    test.skip(!isMockBackend(), 'the live backend serves a space this spec knows nothing about');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Pages', exact: true }).click({ timeout: 60_000 });
    await page.getByText('Console', { exact: true }).click();

    await expect(page.getByRole('img', { name: 'Only for signed-in visitors', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Only for visitors with billing', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Every page in it is protected (2)', exact: true })).toBeVisible();
    // The page anybody may open has none: two pages' locks and the folder's, nothing more.
    await expect(page.getByRole('img', { name: /^Only for|^Every page|pages are protected$/ })).toHaveCount(3);
    await capture('locks-dark');

    // The builder's own theme, kept in its cookie: the same locks, read on light.
    await page.context().addCookies([{ name: 'builder-theme', value: 'light', url: subject.origin }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    // The builder keeps the panel it had open, and a click on its rail button would close it.
    const pages = page.getByRole('button', { name: 'Pages', exact: true });
    await expect(pages).toBeVisible({ timeout: 60_000 });
    if ((await pages.getAttribute('aria-pressed')) !== 'true') {
      await pages.click();
    }
    await expect(page.getByRole('img', { name: 'Every page in it is protected (2)', exact: true })).toBeVisible();
    await capture('locks-light');
  });
});
