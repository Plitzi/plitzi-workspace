import { describeTarget, expect, test } from '../../fixtures';
import { el, openHarness, renderSpace } from '../../helpers/harness';
import { KEYS_IDS, keysSpace } from '../../spaces';

import type { Page } from '@playwright/test';

/** `onKey` flows, pressed in a real browser: on the page they fire, inside a field only Escape does. */

const shown = (page: Page, id: string) => el(page, keysSpace(), id);

describeTarget('harness', () => {
  test('a shortcut runs its own flow, and typing in a field is left alone', async ({ page, step }) => {
    await openHarness(page);
    await renderSpace(page, keysSpace());
    await expect(shown(page, KEYS_IDS.shown)).toHaveText('none');

    await step('+ on the page runs its flow', async () => {
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('+');
      await expect(shown(page, KEYS_IDS.shown)).toHaveText('in');
    });

    await step('Escape runs the other one, and only it', async () => {
      await page.keyboard.press('Escape');
      await expect(shown(page, KEYS_IDS.shown)).toHaveText('reset');
    });

    await step('+ typed in a field is the field’s', async () => {
      const input = shown(page, KEYS_IDS.field).locator('input');
      await input.click();
      await page.keyboard.type('1+1');
      await expect(input).toHaveValue('1+1');
      await expect(shown(page, KEYS_IDS.shown)).toHaveText('reset');
    });
  });
});
