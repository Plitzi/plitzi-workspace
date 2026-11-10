import { describeTarget, expect, test } from '../../fixtures';

/**
 * The builder's top bar at the widths people work at. It needed 1,564 px: at 1440 **Snapshot** and **Publish** were past
 * the window's right edge, at 1280 **Export** and the theme switch too, and nothing scrolled to them. Every control of
 * the bar is inside the window, or in a menu the bar keeps inside it.
 */
describeTarget('builder', subject => {
  for (const width of [1280, 1440, 1728]) {
    test(`keeps every control of its bar inside the window at ${String(width)} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
      const publish = page.locator('#header-deploy');
      await expect(publish).toBeVisible({ timeout: 60_000 });

      const outside = await page.locator('#builder-header').evaluate((bar, limit) => {
        const controls = [...bar.querySelectorAll<HTMLElement>('button, a, [role="button"]')];

        return controls
          .filter(control => control.getClientRects().length > 0)
          .filter(control => control.getBoundingClientRect().right > limit)
          .map(control => control.id || control.title || control.textContent?.trim() || control.tagName);
      }, width);

      expect(outside).toEqual([]);
    });
  }
});
