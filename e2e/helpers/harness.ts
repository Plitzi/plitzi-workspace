import { target } from '../targets';

import type { Page } from '@playwright/test';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** Driving the harness from a spec. `render` settles once React has committed, which is the earliest moment an
 *  assertion can be true — the SDK's own async work (style injection, lazy elements) is still covered by the
 *  auto-waiting every `expect` does afterwards. */

export const HARNESS_ORIGIN = target('harness').origin;

export const openHarness = async (page: Page): Promise<void> => {
  await page.goto(HARNESS_ORIGIN);
  await page.waitForFunction(() => !!window.plitziHarness);
};

export const renderSpace = async (page: Page, offlineData: OfflineDataRaw): Promise<void> => {
  await page.evaluate(async data => {
    const harness = window.plitziHarness;

    if (!harness) {
      throw new Error('the harness never registered — did the page finish loading?');
    }

    await harness.render(data);
  }, offlineData);
};
