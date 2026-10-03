import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { FLAG_IDS, flagsSpace } from '../../spaces';

import type { Page } from '@playwright/test';

/**
 * Feature flags in the browser, with no server behind them: the space's own answer, and the SDK's layer above it.
 *
 * A gate is not a visibility, and that is the assertion: a gated-off element is not in the DOM at all — a hidden one
 * would be, and `toBeHidden` would pass for both.
 */

const space = flagsSpace();

const present = (page: Page, id: string) => page.locator(`[data-plitzi-el="${id}"]`);

describeTarget('harness', () => {
  test('renders the side of each gate the space’s flags choose, and reads them as a source', async ({ page }) => {
    await openHarness(page);
    await renderSpace(page, space);

    await expect(present(page, FLAG_IDS.checkoutOld)).toBeVisible();
    await expect(present(page, FLAG_IDS.checkoutNew)).toHaveCount(0);
    await expect(present(page, FLAG_IDS.promo)).toHaveCount(0);
    await expect(present(page, FLAG_IDS.reading)).toHaveText('false');
  });

  test('lets the SDK embedding the space turn a flag, and only one the space declares', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await openHarness(page);
    await renderSpace(page, space, { flags: { newCheckout: true, notDeclared: true } });

    await expect(present(page, FLAG_IDS.checkoutNew)).toBeVisible();
    await expect(present(page, FLAG_IDS.checkoutOld)).toHaveCount(0);
    await expect(present(page, FLAG_IDS.reading)).toHaveText('true');
    await expect.poll(() => warnings.some(text => text.includes('"notDeclared"'))).toBe(true);
  });
});
