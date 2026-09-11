import { describeTarget, expect, test } from '../../fixtures';
import { target } from '../../targets';

import type { Page } from '@playwright/test';

/** The desktop window's theme, against the spaces it embeds.
 *
 *  The window is one surface with a theme of its own — Tailwind `dark:` over the class `ThemeProvider` writes on
 *  `<html>` — and it mounts the SDK inside it in `container` scope: the rail always, and the space the visitor opens.
 *  Signed out is enough for all of it: the rail is an offline space, so nothing here needs an API behind it.
 *
 *  Run in a browser against the renderer's Vite server, not in Electron. Everything under test is the renderer's. */

const DESKTOP_ORIGIN = target('desktop').origin;

const DARK_CHROME = /^oklch\(0\.1/;
const LIGHT_CHROME = /^oklch\(0\.9/;

const openWindow = async (page: Page): Promise<void> => {
  await page.goto(DESKTOP_ORIGIN);
  await expect(page.locator('.sh-rail')).toBeVisible({ timeout: 60_000 });
};

/** The chrome's own ground: `LayoutMain`, drawn `bg-zinc-50 dark:bg-zinc-950`. */
const chromeBackground = (page: Page): Promise<string> =>
  page
    .locator('.bg-zinc-50')
    .first()
    .evaluate(node => getComputedStyle(node).backgroundColor);

describeTarget('desktop', () => {
  test.describe('on a machine set to dark', () => {
    test.use({ colorScheme: 'dark' });

    test('the chrome follows the machine while the window has made no choice', async ({ page }) => {
      await openWindow(page);

      await expect(page.locator('html')).not.toHaveClass(/\b(dark|light)\b/);
      expect(await chromeBackground(page)).toMatch(DARK_CHROME);
    });

    /** Tailwind's own `dark:` is the media query alone, so the class on `<html>` used to repaint nothing. */
    test('a theme chosen for the window repaints the chrome, whatever the machine says', async ({ page }) => {
      await page.context().addCookies([{ name: 'plitzi-desktop-theme', value: 'light', url: DESKTOP_ORIGIN }]);
      await openWindow(page);

      await expect(page.locator('html')).toHaveClass(/\blight\b/);
      await expect.poll(() => chromeBackground(page)).toMatch(LIGHT_CHROME);
    });
  });

  test.describe('on a machine set to light', () => {
    test.use({ colorScheme: 'light' });

    test('the chrome follows the machine while the window has made no choice', async ({ page }) => {
      await openWindow(page);

      await expect(page.locator('html')).not.toHaveClass(/\b(dark|light)\b/);
      expect(await chromeBackground(page)).toMatch(LIGHT_CHROME);
    });

    /** `localhost` cookies ignore the port, so in development every other app's `theme` cookie lands here too. */
    test('a theme cookie another app left on the origin does not reach the spaces in the window', async ({ page }) => {
      await page.context().addCookies([{ name: 'theme', value: 'dark', url: DESKTOP_ORIGIN }]);
      await openWindow(page);

      const roots = await page.locator('.plitzi-sdk').all();

      expect(roots.length).toBeGreaterThan(0);
      for (const root of roots) {
        await expect(root).not.toHaveClass(/\bdark\b/);
      }

      await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    });
  });
});
