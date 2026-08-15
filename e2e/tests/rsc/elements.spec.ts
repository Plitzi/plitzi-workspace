import { describeTarget, expect, test } from '../../fixtures';
import { rscElement } from '../../helpers/space';

/** The three runtimes, told apart by where they appear.
 *
 *  `server` renders on the server and is never mounted in the browser. `client` is skipped during SSR entirely.
 *  `shared` does both. Asserting that in a browser is the only way: to a unit test they are three components that
 *  all render fine. */
describeTarget('server', subject => {
  test('renders all three runtimes in the browser', async ({ page, capture }) => {
    await page.goto(subject.origin);

    for (const runtime of ['server', 'client', 'shared']) {
      await expect(page.locator(`[data-probe="${runtime}"]`), `the ${runtime} element did not render`).toBeVisible();
    }

    // Only a `server` runtime element carries the reattachment marker — it is the one the client has to find again
    // to refresh it in place. The other two are asserted through what they rendered.
    await expect(rscElement(page, 'rsc-server')).toContainText('from the server');
    await expect(page.locator('[data-probe="shared"]')).toContainText('from both');

    await capture('three-runtimes');
  });

  /** The client-only element must be ABSENT from the server response. Rendering it there would run browser code on
   *  the server — the failure this runtime exists to prevent. */
  test('leaves the client-only element out of the server response', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html, 'the server rendered a client-only element').not.toContain('data-probe="client"');
    expect(html, 'the server did not render its own element').toContain('data-probe="server"');
  });

  test('inlines the server slices into the page, so nothing is fetched to show them', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html).toContain('from the server');
  });
});
