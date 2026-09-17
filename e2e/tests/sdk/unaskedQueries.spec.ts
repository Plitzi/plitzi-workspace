import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { ORDER_ID, ORDER_PATH, UNASKED_IDS, unaskedQuerySpace } from '../../spaces';

import type { Page } from '@playwright/test';

/**
 * A provider with nothing to ask: what it must not send, and what it must not claim.
 *
 * Both were found on a dashboard, in the commit between two pages — the destination's route params are written before
 * the outgoing page is replaced, so a provider whose URL names one renders once with the param gone. That timing is
 * the real site's (a shell around the pages, a server render, data arriving); here the same two states are reached
 * from a button, which is the deterministic half of it. What each one protects is written on the assertion.
 */

/** Every request the page makes for an order, whatever the URL ended up being. */
const watchOrders = async (page: Page) => {
  const asked: string[] = [];
  await page.route(`**${ORDER_PATH}/**`, route => {
    asked.push(decodeURIComponent(new URL(route.request().url()).pathname));

    return route.fulfill({ json: { title: `Order ${route.request().url().split('/').pop() ?? ''}` } });
  });

  return { asked };
};

const click = (page: Page, id: string) => page.locator(`.${id}`).click();

describeTarget('harness', () => {
  test('a URL that still carries a token is not a question, and is never asked', async ({ page }) => {
    const orders = await watchOrders(page);
    await openHarness(page);
    await renderSpace(page, unaskedQuerySpace());

    await expect(page.locator(`.${UNASKED_IDS.load}`)).toBeVisible();
    // Long enough for a request that was going to happen to have happened.
    await page.waitForTimeout(500);

    // `/__e2e/order/{{orderId}}`, which is what an attribute holds until something answers the token. Asked for, it
    // is a 404 against whatever the URL happens to spell.
    expect(orders.asked, 'the half-resolved URL was asked for').toEqual([]);
  });

  test('a provider keeps its answer on screen but stops reporting success once it has nothing to ask', async ({
    page,
    step
  }) => {
    const orders = await watchOrders(page);
    await openHarness(page);
    await renderSpace(page, unaskedQuerySpace());

    await step('loading the order asks once and runs the flow behind it', async () => {
      await click(page, UNASKED_IDS.load);
      await expect(page.locator(`.${UNASKED_IDS.title}`)).toHaveText(`Order ${ORDER_ID}`);
      await expect(page.locator(`.${UNASKED_IDS.seen}`)).toHaveText(ORDER_ID);
      expect(orders.asked).toEqual([`${ORDER_PATH}/${ORDER_ID}`]);
    });

    await step('emptying its URL asks nothing and leaves what it holds on screen', async () => {
      await click(page, UNASKED_IDS.clear);
      await page.waitForTimeout(500);

      expect(orders.asked).toEqual([`${ORDER_PATH}/${ORDER_ID}`]);
      // The last answer stays: a provider that reported "nothing yet" here would unmount everything it feeds, and
      // the page would collapse and come back a frame later.
      await expect(page.locator(`.${UNASKED_IDS.title}`)).toHaveText(`Order ${ORDER_ID}`);
    });

    await step('and does not run onApiSuccess again for a URL it never asked', async () => {
      // The flow writes whatever the state holds NOW. Fired again with the state cleared, it writes an empty string —
      // which on the dashboard was the workspace id everything else was keyed by.
      await expect(page.locator(`.${UNASKED_IDS.seen}`), 'the flow ran again').toHaveText(ORDER_ID);
    });
  });
});
