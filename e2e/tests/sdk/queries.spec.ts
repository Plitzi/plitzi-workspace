import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { ORDERS_PATH, QUERY_IDS, querySpace } from '../../spaces';

import type { Page } from '@playwright/test';

/**
 * The query cache, counted at the network.
 *
 * Every assertion that matters is a number of requests, because that is the whole claim: the page shows the same
 * thing either way, and a cache that silently asked every time would pass any check made on the content.
 */

/** Answers the provider's requests itself, numbering them so a spec can also see WHICH answer is on screen. */
const answerOrders = async (page: Page) => {
  let served = 0;
  await page.route(`**${ORDERS_PATH}`, route => {
    served += 1;

    return route.fulfill({ json: { title: `Orders #${served}` } });
  });

  return { count: () => served };
};

const title = (page: Page) => page.locator(`.${QUERY_IDS.title}`);

const togglePanel = (page: Page) => page.locator(`.${QUERY_IDS.toggle}`).click();

describeTarget('harness', () => {
  test('a provider shown again inside its cache time answers without asking', async ({ page, step }) => {
    const orders = await answerOrders(page);
    await openHarness(page);
    await renderSpace(page, querySpace());

    await step('a hidden provider asks nothing', async () => {
      await expect(page.locator(`.${QUERY_IDS.toggle}`)).toBeVisible();
      expect(orders.count()).toBe(0);
    });

    await step('opening the panel asks once', async () => {
      await togglePanel(page);
      await expect(title(page)).toHaveText('Orders #1');
      expect(orders.count()).toBe(1);
    });

    await step('closing and opening it again is served from the cache', async () => {
      await togglePanel(page);
      await expect(title(page)).toBeHidden();
      await togglePanel(page);
      await expect(title(page)).toHaveText('Orders #1');
      // Long enough for a request that was going to happen to have happened.
      await page.waitForTimeout(300);
      expect(orders.count()).toBe(1);
    });

    await step('saying the orders changed asks again for the provider on screen', async () => {
      await page.locator(`.${QUERY_IDS.invalidate}`).click();
      await expect(title(page)).toHaveText('Orders #2');
      expect(orders.count()).toBe(2);
    });
  });

  test('an invalidated provider that is not on screen asks when it is shown, and keeps its answer until then', async ({
    page
  }) => {
    const orders = await answerOrders(page);
    await openHarness(page);
    await renderSpace(page, querySpace());

    await togglePanel(page);
    await expect(title(page)).toHaveText('Orders #1');
    await togglePanel(page);

    await page.locator(`.${QUERY_IDS.invalidate}`).click();
    await page.waitForTimeout(300);
    expect(orders.count()).toBe(1);

    await togglePanel(page);
    await expect(title(page)).toHaveText('Orders #2');
    expect(orders.count()).toBe(2);
  });

  test('a provider with no cache time asks every time it is shown', async ({ page }) => {
    const orders = await answerOrders(page);
    await openHarness(page);
    await renderSpace(page, querySpace('0'));

    await togglePanel(page);
    await expect(title(page)).toHaveText('Orders #1');
    await togglePanel(page);
    await togglePanel(page);

    await expect(title(page)).toHaveText('Orders #2');
    expect(orders.count()).toBe(2);
  });
});
