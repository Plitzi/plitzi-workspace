import { describeTarget, expect, test } from '../../fixtures';
import { expectSampleSpaceContent, expectSpaceRendered } from '../../helpers/space';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';
import { sampleSpace } from '../../spaces';

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
    await expectSpaceRendered(page, sampleSpace());
    await expectVisuallyHealthy(page);

    await capture('server-rendered');
  });

  test('answers its health endpoint', async ({ request }) => {
    const response = await request.get(`${subject.origin}/health`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ role: 'e2e', ok: true });
  });

  /** A path no page claims is redirected to the default page rather than answered with a 404. That is the SDK
   *  router's decision, not this server's — pinned here because it is the kind of behaviour that changes by
   *  accident, and because a site that answers 200 for every URL ever typed is a deliberate choice to have made. */
  test('sends a path no page claims to the default page', async ({ request }) => {
    const response = await request.get(`${subject.origin}/nothing-here`, { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe('/');
  });
});
