import { describeTarget, expect, test } from '../../../fixtures';
import { expectPageWhole } from '../../../helpers/harness';
import { expectSampleSpaceContent } from '../../../helpers/space';
import { sampleAuthored } from '../../../spaces';

describeTarget('server', subject => {
  /** The claim server rendering makes is not that the page renders — the SDK does that in the browser too — but
   *  that the space is in the HTML before a single script has run. Only the raw response can tell the two apart:
   *  from the DOM, by the time you look, the bundle has already executed. */
  test('puts the space in the HTML before any script runs', async ({ request }) => {
    const response = await request.get(subject.origin);

    expect(response.status()).toBe(200);

    const html = await response.text();

    expect(html, 'the heading is missing from the server response').toContain('Welcome To Plitzi');
    expect(html, 'elements arrived without their schema ids').toContain('data-id=');
  });

  test('hydrates into a complete, visible page', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSampleSpaceContent(page);
    await expectPageWhole(page, sampleAuthored(), { elements: 'all' });

    await capture('server-rendered');
  });

  test('answers its health endpoint', async ({ request }) => {
    const response = await request.get(`${subject.origin}/health`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ role: 'e2e', ok: true });
  });

  /** A path no page claims is answered by the space's `'*'` page, with status 404 — not redirected home, which told a
   *  crawler and a mistyped link alike that every URL ever typed exists. Pinned here because it is the kind of
   *  behaviour that changes by accident: the status and the page both come from the server, before any script. */
  test('answers a path no page claims with its not-found page, as a 404', async ({ request }) => {
    const response = await request.get(`${subject.origin}/nothing-here`, { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
    expect(await response.text(), 'the not-found page is missing from the server response').toContain('Page not found');
  });
});
