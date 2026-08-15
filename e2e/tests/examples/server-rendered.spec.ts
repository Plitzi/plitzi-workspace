import { describeTarget, expect, test } from '../../fixtures';
import { expectSharedSpace } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

describeTarget('server-rendered', subject => {
  /** The claim of this example is not that the page renders — the three before it already do — but that the HTML
   *  arrives with the space already in it. Asserting that from the DOM would prove nothing, because by then the
   *  browser has run the bundle: only the raw response can tell the two apart. */
  test('serves the space in the HTML, before any script runs', async ({ request }) => {
    const response = await request.get(subject.origin);

    expect(response.status()).toBe(200);

    const html = await response.text();

    expect(html, 'the heading is missing from the server response').toContain('Welcome To Plitzi');
    expect(html, 'elements are missing their schema ids').toContain('data-id="65522cc49b57167ea7a2a076"');
  });

  test('hydrates into a working page', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSharedSpace(page);
    await expectVisuallyHealthy(page);

    await capture('server-rendered');
  });
});
