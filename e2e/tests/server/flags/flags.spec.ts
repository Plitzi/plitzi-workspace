import { describeTarget, expect, test } from '../../../fixtures';
import { FLAG_IDS, FLAG_TEXT } from '../../../spaces';

import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Feature flags on a page server: what arrives before a script runs, decided by every layer a server sees.
 *
 * The HTML is read as markup — `data-plitzi-el` is written by the render and nowhere else — so a gated-off element is
 * asserted ABSENT from what the server sent, not merely hidden by the browser. A gate that only hid would ship the
 * feature's markup to every visitor.
 */

const markupOf = async (request: APIRequestContext, url: string, cookie?: string) => {
  const response = await request.get(url, cookie ? { headers: { cookie } } : {});

  return { status: response.status(), html: await response.text() };
};

const rendered = (html: string, id: string) => html.includes(`data-plitzi-el="${id}"`);

const forced = (port: number, value: string) => `plitzi_flags_${port}=${encodeURIComponent(value)}`;

describeTarget('flags-server', subject => {
  const port = Number(new URL(subject.origin).port);

  test('the server draws the space’s choice, its own layer above it, and a rule on the URL', async ({ request }) => {
    const { html } = await markupOf(request, `${subject.origin}/`);

    expect(rendered(html, FLAG_IDS.checkoutOld)).toBe(true);
    expect(rendered(html, FLAG_IDS.checkoutNew)).toBe(false);
    // Off in the space, on for this deployment: `createServer({ flags })`.
    expect(rendered(html, FLAG_IDS.byServer)).toBe(true);
    expect(rendered(html, FLAG_IDS.promo)).toBe(false);

    const promo = await markupOf(request, `${subject.origin}/?promo=yes`);
    expect(rendered(promo.html, FLAG_IDS.promo)).toBe(true);
  });

  test('a page gated off is not found, and is there once a tester forces its flag on', async ({ request }) => {
    expect((await markupOf(request, `${subject.origin}/labs`)).status).toBe(404);
    expect((await markupOf(request, `${subject.origin}/labs`, forced(port, 'labs:1'))).status).toBe(200);
  });

  test('a tester forces a flag from the dev tools, live and then on the server', async ({ page, context }) => {
    // The dev tools open on their Flags tab: `useStorage` keeps both under the `plitzi-sdk` key.
    await context.addInitScript(() => {
      localStorage.setItem('plitzi-sdk', JSON.stringify({ 'dev-tools': { collapsed: false, tab: 'flags' } }));
    });
    const element = (id: string) => page.locator(`[data-plitzi-el="${id}"]`);

    await page.goto(subject.origin);
    await expect(page.getByText(FLAG_TEXT.checkoutOld)).toBeVisible();
    await expect(element(FLAG_IDS.reading)).toHaveText('false');

    await page.getByTitle('Force this flag on for this browser').first().click();
    await expect(page.getByText(FLAG_TEXT.checkoutNew)).toBeVisible();
    await expect(element(FLAG_IDS.checkoutOld)).toHaveCount(0);
    await expect(element(FLAG_IDS.reading)).toHaveText('true');

    // The cookie the dev tools wrote reaches the server: the next page is DRAWN with the flag on.
    const cookie = (await context.cookies(subject.origin)).find(entry => entry.name === `plitzi_flags_${port}`);
    expect(cookie?.value).toBe(encodeURIComponent('newCheckout:1'));
    await page.reload();
    await expect(page.getByText(FLAG_TEXT.checkoutNew)).toBeVisible();

    await page.getByText('Stop forcing all').click();
    await expect(page.getByText(FLAG_TEXT.checkoutOld)).toBeVisible();
    await expect(element(FLAG_IDS.checkoutNew)).toHaveCount(0);
  });

  test('a flag the server sets and the space does not declare changes nothing', async ({ page }: { page: Page }) => {
    const warnings: string[] = [];
    page.on('console', message => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await page.goto(subject.origin);
    await expect(page.getByText(FLAG_TEXT.byServer)).toBeVisible();
    await expect.poll(() => warnings.some(text => text.includes('"notDeclared"'))).toBe(true);
  });
});

describeTarget('flags-no-debug-server', subject => {
  const port = Number(new URL(subject.origin).port);

  test('where nobody authorized debugging, a forced flag is ignored — the page and the gated one alike', async ({
    request
  }) => {
    const home = await markupOf(request, `${subject.origin}/`, forced(port, 'newCheckout:1'));
    expect(rendered(home.html, FLAG_IDS.checkoutOld)).toBe(true);
    expect(rendered(home.html, FLAG_IDS.checkoutNew)).toBe(false);
    expect(home.html).not.toContain('forcedFlags');

    expect((await markupOf(request, `${subject.origin}/labs`, forced(port, 'labs:1'))).status).toBe(404);
  });
});
