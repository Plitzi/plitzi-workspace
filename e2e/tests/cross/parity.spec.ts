import { expect, test } from '../../fixtures';
import { openHarness } from '../../helpers/harness';
import { target } from '../../targets';

import type { Page } from '@playwright/test';

/** The same space, through both render paths, has to come out the same.
 *
 *  This is the check neither category can make alone. `sdk` proves the browser renders it; `ssr` proves the server
 *  does. Only comparing the two catches the class of bug where both are individually fine and they disagree — the
 *  hydration mismatch, the element that renders server-side and vanishes client-side, the style one path applies
 *  and the other does not. */

const inventory = (page: Page) =>
  page.evaluate(() => {
    const counts: Record<string, number> = {};

    [...document.querySelectorAll('[class*="plitzi-component__"]')].forEach(node => {
      const type = /plitzi-component__([a-z]+)\b/.exec(node.className)?.[1];

      if (type) {
        counts[type] = (counts[type] ?? 0) + 1;
      }
    });

    const headings = [...document.querySelectorAll('.plitzi-component__heading')].map(
      node => node.textContent?.trim() ?? ''
    );

    return { counts, headings };
  });

test.describe('client-side and server-side render of one space', () => {
  test('agree on what the space contains', async ({ page, capture }) => {
    await openHarness(page);
    const clientSide = await inventory(page);
    await capture('client-side');

    await page.goto(target('server').origin);
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();
    const serverSide = await inventory(page);
    await capture('server-side');

    // The server additionally renders the RSC elements, which are plugins and carry no `plitzi-component__` class
    // of their own — so the built-in inventory is exactly the part that must match.
    expect(serverSide.counts, 'the two render paths disagree on what the space contains').toEqual(clientSide.counts);
    expect(serverSide.headings, 'the two render paths disagree on the copy').toEqual(clientSide.headings);
  });

  /** Hydration is where the two paths meet, and a mismatch there is reported to the console and nowhere else — the
   *  page keeps working, subtly, off the wrong tree. The console guard every spec runs under is what catches it;
   *  this test exists to put a server-rendered page in front of it and let it hydrate. */
  test('hydrate without React reporting a mismatch', async ({ page }) => {
    await page.goto(target('server').origin);

    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();
    await expect(page.locator('[data-probe="client"]'), 'the page never hydrated').toBeVisible();
  });
});
