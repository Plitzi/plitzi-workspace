import { target } from '../targets';

import type { Page } from '@playwright/test';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/** Driving the harness from a spec. `render` settles once React has committed, which is the earliest moment an
 *  assertion can be true — the SDK's own async work (style injection, lazy elements) is still covered by the
 *  auto-waiting every `expect` does afterwards. */

export const HARNESS_ORIGIN = target('harness').origin;

/** Waits for the harness to have rendered once, not merely to have registered.
 *
 *  The first request to the harness compiles the SDK's whole dependency graph, which on a cold start takes longer
 *  than an assertion's default timeout — so a spec that began the moment `plitziHarness` appeared would race the
 *  compiler and fail somewhere unrelated. Handing it a page that has already painted removes that race from every
 *  spec at once. */
export const openHarness = async (page: Page): Promise<void> => {
  await page.goto(HARNESS_ORIGIN);
  await page.waitForFunction(() => !!window.plitziHarness, undefined, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelectorAll('[class*="plitzi-component__"]').length > 0, undefined, {
    timeout: 60_000
  });
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
