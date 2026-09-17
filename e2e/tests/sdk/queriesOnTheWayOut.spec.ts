import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { ROUTE_ORDER_ID, ROUTE_ORDER_PATH, ROUTE_QUERY_IDS, routeQuerySpace } from '../../spaces';

import type { Page } from '@playwright/test';

/**
 * The same two invariants as `unaskedQueries.spec.ts`, reached the way a person reached them: by leaving the page.
 *
 * A navigation writes the destination's route params one commit before the outgoing page is replaced — a shell is
 * what keeps the page alive for that commit — so the provider renders once with `orderId` gone and its URL holding
 * the token nothing answered.
 */

/** Every request the page makes for an order, whatever the URL ended up being. */
const watchOrders = async (page: Page) => {
  const asked: string[] = [];
  await page.route(`**${ROUTE_ORDER_PATH}/**`, route => {
    asked.push(decodeURIComponent(new URL(route.request().url()).pathname));

    return route.fulfill({ json: { title: `Order ${ROUTE_ORDER_ID}` } });
  });

  return { asked };
};

const open = (page: Page, id: string) => page.locator(`.${id}`).click();

describeTarget('harness', () => {
  test('leaving a page asks nothing, and does not run its flows again', async ({ page, step }) => {
    const orders = await watchOrders(page);
    await openHarness(page);
    await renderSpace(page, routeQuerySpace());

    await step('the detail page asks once, for the order it is showing', async () => {
      await open(page, ROUTE_QUERY_IDS.toOrder);
      await expect(page.locator(`.${ROUTE_QUERY_IDS.title}`)).toHaveText(`Order ${ROUTE_ORDER_ID}`);
      expect(orders.asked).toEqual([`${ROUTE_ORDER_PATH}/${ROUTE_ORDER_ID}`]);
    });

    await step('leaving it asks for nothing', async () => {
      await open(page, ROUTE_QUERY_IDS.toHome);
      await expect(page.locator(`.${ROUTE_QUERY_IDS.toOrder}`)).toBeVisible();
      // Long enough for a request that was going to happen to have happened.
      await page.waitForTimeout(500);

      expect(orders.asked, 'the URL it could no longer resolve was asked for').toEqual([
        `${ROUTE_ORDER_PATH}/${ROUTE_ORDER_ID}`
      ]);
    });

    await step('and the flow behind onApiSuccess did not run again', async () => {
      // It writes `routeParams.orderId`, which by then is gone: a second firing empties what the page is keyed by.
      await expect(page.locator(`.${ROUTE_QUERY_IDS.seen}`), 'the flow ran again on the way out').toHaveText(
        ROUTE_ORDER_ID
      );
    });
  });
});
