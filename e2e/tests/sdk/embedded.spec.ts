import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { MINIMAL_IDS, minimalSpace, nestedSpace } from '../../spaces';

/** A space drawn inside another — by the `plitziSdk` element, or by a plugin rendering `<PlitziSdk>` — is as tall as
 *  what it holds. A space that IS the page is at least the window tall; inside a box it took the window's height
 *  anyway, a card of three lines drawn as a screen of empty background. */

describeTarget('harness', () => {
  for (const through of ['plitziSdk', 'nestedSdk'] as const) {
    test(`a space drawn inside another by ${through} is as tall as what it holds`, async ({ page }) => {
      await openHarness(page);
      await renderSpace(page, nestedSpace(minimalSpace({ heading: 'Inner card' }), through));
      const inner = page.locator('.plitzi-sdk .plitzi-sdk');
      await expect(inner.locator(`[data-plitzi-el="${MINIMAL_IDS.heading}"]`)).toHaveText('Inner card');

      const viewport = page.viewportSize()?.height ?? 0;
      const height = await inner.evaluate(node => node.getBoundingClientRect().height);

      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThan(viewport / 2);
    });
  }
});
