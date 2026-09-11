import { describeTarget, expect, test } from '../../fixtures';
import { HARNESS_ORIGIN, openHarness, renderSpace } from '../../helpers/harness';
import { THEMED_BACKGROUND, THEMED_IDS, themedSpace } from '../../spaces';

import type { Page } from '@playwright/test';

/** Light and dark, through the two ways the SDK can be mounted.
 *
 *  `document` is a space that IS the page: it wears the choice on `<html>` and keeps it in the `theme` cookie.
 *  `container` is a space EMBEDDED in an application with a theme of its own — the desktop window — and owes the
 *  document nothing: it wears its choice on its own root, and neither reads nor writes the page's cookie.
 *
 *  Every assertion that matters is a COMPUTED colour. The class was never the part that broke: it landed on the
 *  embedded root while the palette stayed keyed to `:root`, and a check on the class passed over a space that had not
 *  changed colour at all. */

const pageBackground = (page: Page): Promise<string> =>
  page.locator(`.${THEMED_IDS.page}`).evaluate(node => getComputedStyle(node).backgroundColor);

const themeCookie = async (page: Page): Promise<string | undefined> =>
  (await page.context().cookies(HARNESS_ORIGIN)).find(cookie => cookie.name === 'theme')?.value;

const sdkRoot = (page: Page) => page.locator('.plitzi-sdk');

describeTarget('harness', () => {
  test.describe('on a machine set to light', () => {
    test.use({ colorScheme: 'light' });

    test('a space that is the page wears the choice on the document, and remembers it', async ({ page }) => {
      await openHarness(page);
      await renderSpace(page, themedSpace());
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.light);

      await page.locator(`.${THEMED_IDS.toggle}`).click();

      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.dark);
      expect(await themeCookie(page)).toBe('dark');

      // The next visit starts from the choice, before anything is clicked.
      await openHarness(page);
      await renderSpace(page, themedSpace());

      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.dark);
    });

    test('an embedded space repaints itself and nothing around it', async ({ page }) => {
      await openHarness(page);
      const cookieBefore = await themeCookie(page);
      await renderSpace(page, themedSpace(), { themeScope: 'container' });
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.light);

      await page.locator(`.${THEMED_IDS.toggle}`).click();

      await expect(sdkRoot(page)).toHaveClass(/\bdark\b/);
      await expect
        .poll(() => pageBackground(page), 'the palette follows the class onto the embedded root')
        .toBe(THEMED_BACKGROUND.dark);
      await expect(page.locator('html')).not.toHaveClass(/\b(dark|light)\b/);
      expect(await themeCookie(page), 'the page cookie is not the embedded space’s to write').toBe(cookieBefore);
    });

    /** In development the desktop shares `localhost` with every app on another port, and any of them may have left a
     *  `theme` cookie there. A space that read it came up dark inside a window that was light. */
    test('an embedded space does not start from the page’s cookie', async ({ page }) => {
      await openHarness(page);
      await page.context().addCookies([{ name: 'theme', value: 'dark', url: HARNESS_ORIGIN }]);
      await renderSpace(page, themedSpace(), { themeScope: 'container' });

      await expect(page.locator(`.${THEMED_IDS.page}`)).toBeVisible();
      await expect(sdkRoot(page)).not.toHaveClass(/\bdark\b/);
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.light);
    });
  });

  test.describe('on a machine set to dark', () => {
    test.use({ colorScheme: 'dark' });

    test('an embedded space with no choice of its own follows the machine', async ({ page }) => {
      await openHarness(page);
      await renderSpace(page, themedSpace(), { themeScope: 'container' });

      await expect(sdkRoot(page)).not.toHaveClass(/\b(dark|light)\b/);
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.dark);
    });

    test('an embedded space chosen light stays light on a dark machine', async ({ page }) => {
      await openHarness(page);
      await renderSpace(page, themedSpace(), { themeScope: 'container' });

      await page.locator(`.${THEMED_IDS.toggle}`).click();

      await expect(sdkRoot(page)).toHaveClass(/\blight\b/);
      await expect.poll(() => pageBackground(page)).toBe(THEMED_BACKGROUND.light);
    });
  });
});
