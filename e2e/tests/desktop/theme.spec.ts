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

/** Bounds on the chrome's luminance, 0 (black) to 1 (white): the theme is what is asserted, not how the palette writes
 *  its colours — the same zinc reads `oklch(…)` from Tailwind's own palette and `rgb(…)` from the design tokens. */
const isDarkChrome = (luminance: number): boolean => luminance < 0.2;
const isLightChrome = (luminance: number): boolean => luminance > 0.85;

const openWindow = async (page: Page): Promise<void> => {
  await page.goto(DESKTOP_ORIGIN);
  await expect(page.locator('.sh-rail')).toBeVisible({ timeout: 60_000 });
};

/** The chrome's own ground, `LayoutMain`'s `bg-zinc-50 dark:bg-zinc-950`, as its luminance: the browser paints the
 *  computed colour into a canvas, which reads back sRGB whatever space the colour was written in. */
const chromeLuminance = (page: Page): Promise<number> =>
  page
    .locator('.bg-zinc-50')
    .first()
    .evaluate(node => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) {
        return Number.NaN;
      }

      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

      return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    });

describeTarget('desktop', () => {
  test.describe('on a machine set to dark', () => {
    test.use({ colorScheme: 'dark' });

    test('the chrome follows the machine while the window has made no choice', async ({ page }) => {
      await openWindow(page);

      await expect(page.locator('html')).not.toHaveClass(/\b(dark|light)\b/);
      expect(isDarkChrome(await chromeLuminance(page))).toBe(true);
    });

    /** Tailwind's own `dark:` is the media query alone, so the class on `<html>` used to repaint nothing. */
    test('a theme chosen for the window repaints the chrome, whatever the machine says', async ({ page }) => {
      await page.context().addCookies([{ name: 'plitzi-desktop-theme', value: 'light', url: DESKTOP_ORIGIN }]);
      await openWindow(page);

      await expect(page.locator('html')).toHaveClass(/\blight\b/);
      await expect.poll(async () => isLightChrome(await chromeLuminance(page))).toBe(true);
    });
  });

  test.describe('on a machine set to light', () => {
    test.use({ colorScheme: 'light' });

    test('the chrome follows the machine while the window has made no choice', async ({ page }) => {
      await openWindow(page);

      await expect(page.locator('html')).not.toHaveClass(/\b(dark|light)\b/);
      expect(isLightChrome(await chromeLuminance(page))).toBe(true);
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
