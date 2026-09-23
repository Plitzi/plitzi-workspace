import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { KEPT_IDS, keptStateSpace } from '../../spaces';

import type { Page } from '@playwright/test';

/**
 * Kept state, across a real reload of the browser: what a person expects back comes back, and what the space declares
 * transient starts fresh. A unit test can only simulate the reload; here the storage is the browser's own.
 */

const shown = (page: Page, id: string) => page.locator(`.${id}`);

describeTarget('harness', () => {
  test('keeps what the space keeps, and starts the transient keys fresh', async ({ page, step }) => {
    await openHarness(page);
    await renderSpace(page, keptStateSpace());

    await step('both keys are written', async () => {
      await shown(page, KEPT_IDS.keep).click();
      await shown(page, KEPT_IDS.draft).click();
      await expect(shown(page, KEPT_IDS.keptText)).toHaveText('saved');
      await expect(shown(page, KEPT_IDS.draftText)).toHaveText('typed');
    });

    await step('only the kept one reaches the storage', async () => {
      const stored = await page.evaluate(() =>
        Object.keys(localStorage)
          .filter(key => key.endsWith('_state'))
          .map(key => localStorage.getItem(key) ?? '')
          .join('')
      );
      expect(stored).toContain('saved');
      expect(stored).not.toContain('typed');
    });

    await step('after a reload the kept key is back and the transient one is not', async () => {
      await page.reload();
      await openHarness(page);
      await renderSpace(page, keptStateSpace());
      await expect(shown(page, KEPT_IDS.keptText)).toHaveText('saved');
      await expect(shown(page, KEPT_IDS.draftText)).toHaveText('none');
    });
  });
});
