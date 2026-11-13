import { authorSpace, heading } from '@plitzi/sdk-authoring';

import { describeTarget, expect, isMockBackend, test } from '../../fixtures';

/**
 * A page's settings, in sections: the page's own fields open, and access, scroll and search each one click away with
 * what they hold said on their header — the form was one column of every field and a notice under each, longer than
 * the panel. Captured in both of the builder's themes.
 */
const space = () =>
  authorSpace({
    name: 'Settings',
    permanentUrl: 'settings',
    pages: [
      {
        id: 'home',
        name: 'Home',
        slug: '',
        isDefault: true,
        accessLevel: 'authenticated',
        documentScroll: 'locked',
        body: [heading('Home', { id: 'home-title' })]
      }
    ]
  });

describeTarget('builder', subject => {
  test.use({ mockSpace: space() });

  test('lays a page’s settings out in sections that say what they hold', async ({ page, capture }) => {
    test.skip(!isMockBackend(), 'the live backend serves a space this spec knows nothing about');

    for (const theme of ['dark', 'light']) {
      await page.context().addCookies([{ name: 'builder-theme', value: theme, url: subject.origin }]);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
      const layers = page.getByRole('button', { name: 'Layers', exact: true });
      await expect(layers).toBeVisible({ timeout: 60_000 });
      if ((await layers.getAttribute('aria-pressed')) !== 'true') {
        await layers.click();
      }

      // The page's own layer, by its id: the top bar names the page too.
      await page.getByText('home', { exact: true }).click();
      await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      await expect(page.getByText('Page Name', { exact: true })).toBeVisible();
      await expect(page.getByText('Signed-in visitors', { exact: true })).toBeVisible();
      await expect(page.getByText('Locked', { exact: true })).toBeVisible();
      await capture(`page-settings-${theme}`);
    }
  });
});
