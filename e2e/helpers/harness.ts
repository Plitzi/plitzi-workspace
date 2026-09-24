import { expect } from '@playwright/test';

import { inspectPage, locate } from '@plitzi/sdk-authoring';

import { target } from '../targets';

import type { HarnessRenderOptions } from '../harness/src/Harness/types';
import type { Locator, Page } from '@playwright/test';
import type { AuthoredSpace, InspectOptions } from '@plitzi/sdk-authoring';
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

export const renderSpace = async (
  page: Page,
  offlineData: OfflineDataRaw,
  options: HarnessRenderOptions = {}
): Promise<void> => {
  // Only the documents cross into the page: an authored space also carries its handles, whose lookups are functions
  // and cannot be serialized — and the harness has no use for them anyway.
  const { schema, style, plugins, segments } = offlineData;
  const documents: OfflineDataRaw = {
    schema,
    style,
    ...(plugins ? { plugins } : {}),
    ...(segments ? { segments } : {})
  };
  await page.evaluate(
    async ([data, renderOptions]) => {
      const harness = window.plitziHarness;

      if (!harness) {
        throw new Error('the harness never registered — did the page finish loading?');
      }

      await harness.render(data, renderOptions);
    },
    [documents, options] as const
  );
};

/** An authored element on the page, by the name the space gave it — `data-plitzi-el`, present in both render paths.
 *  A name the space does not have throws here, with the nearest one, instead of timing out on an empty locator. */
export const el = (page: Page, space: Pick<AuthoredSpace, 'handles'>, id: string): Locator =>
  locate(page, space.handles)(id);

/** The page rendered whole: every element it owes present and visible, images loaded, nothing scrolling sideways,
 *  no text in the colour behind it — one assertion that prints every problem, and why, when it fails. */
export const expectPageWhole = async (
  page: Page,
  space: Pick<AuthoredSpace, 'handles'>,
  options: InspectOptions = {}
): Promise<void> => {
  const report = await inspectPage(page, space.handles, options);

  expect(report.problems, `page "${report.page}", ${report.checked} elements owed`).toEqual([]);
};
