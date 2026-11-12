import { describeTarget, expect, test } from '../../fixtures';

/**
 * The builder's rail. A click on one of its buttons added that panel as a closed strip under the open **Elements**:
 * after five clicks, five strips and nothing of what was asked for on screen (plitzi-ui's accordion read its default
 * once, when it mounted). Each click now shows that panel's content; the buttons are named, for a pointer and a
 * screen reader alike.
 */
/** Each rail button by its name, and the title its panel opens with. */
const PANELS: readonly (readonly [string, string])[] = [
  ['Pages', 'Pages'],
  ['Variables and Feature Flags', 'Variables'],
  ['Assets', 'Assets'],
  ['Layers', 'Layers'],
  ['Usages', 'Usages'],
  ['Advanced style', 'Advanced style'],
  ['State Manager', 'State Manager']
];

describeTarget('builder', subject => {
  test('shows the panel a rail button names, open, at each click', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(subject.origin, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Elements', exact: true })).toBeVisible({ timeout: 60_000 });

    for (const [name, title] of PANELS) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button, `the rail names ${name}`).toBeVisible();
      await button.click();

      // The panel open, its header naming it: an accordion item expanded, its content drawn.
      const panel = page.locator('[aria-expanded="true"]').filter({ has: page.getByText(title, { exact: true }) });
      await expect(panel.first(), `${title} opens`).toBeVisible();
      await expect(button, `${title}'s button says it is open`).toHaveAttribute('aria-pressed', 'true');
    }
  });
});
