import { describeTarget, expect, test } from '../../fixtures';

/** Tremor's README: every earthquake the USGS publishes, on a globe you can spin, with a display that counts them. */

describeTarget('seismic', subject => {
  test('the globe holds the feed, and the log counts it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(subject.origin);

    const globe = page.getByRole('application', { name: /World seismic map/ });
    await expect(globe).toBeVisible();
    // The feed arrives on the server and reaches the globe with the page: the label says how many it holds.
    await expect(globe).toHaveAttribute('aria-label', /World seismic map, [1-9]\d* events in the window/);
    await expect(page.locator('[data-plitzi-el="log-count"]')).toHaveText(/^\d+ contacts$/);
    expect(errors).toEqual([]);
  });
});
