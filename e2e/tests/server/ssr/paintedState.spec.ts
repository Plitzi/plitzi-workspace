import { describeTarget, expect, test } from '../../../fixtures';
import { mintPreview, previewUrl } from '../../../helpers/preview';
import { SAMPLE_REFS } from '../../../spaces';

import type { PreviewOperation } from '../../../helpers/preview';

/**
 * Kept state the first paint shows (`settings.paintedState`), drawn by the SERVER from the cookie the SDK writes it to.
 *
 * Kept state otherwise lives in web storage, restored after hydration, so a page showing it is drawn with the defaults
 * and swapped a moment later. The claim here is the one only the raw response can make: the value is in the HTML
 * before a single script has run — and the page then hydrates onto it without throwing the tree away.
 *
 * A draft, so the sample space is left as it is: the heading shows `state.favourite`, which the space declares painted.
 */
describeTarget('server', subject => {
  const drawsFavourite: PreviewOperation[] = [
    { type: 'patchSettings', keepState: true, paintedState: ['favourite'] },
    {
      type: 'upsertBinding',
      pageRef: SAMPLE_REFS.page,
      ref: SAMPLE_REFS.mainHeading,
      category: 'attributes',
      binding: { to: 'content', source: 'state.favourite' }
    }
  ];

  const port = new URL(subject.origin).port;
  const painted = (values: Record<string, unknown>) =>
    `plitzi_0_painted_${port}=${encodeURIComponent(JSON.stringify({ owner: 'guest', values }))}`;

  test('draws the kept value into the HTML before any script runs', async ({ request }) => {
    const token = await mintPreview(request, subject.origin, drawsFavourite);
    const response = await request.get(previewUrl(subject.origin, token), {
      headers: { cookie: painted({ favourite: 'Kept in a cookie' }) }
    });

    expect(response.status()).toBe(200);
    expect(await response.text(), 'the server drew the default, not the kept value').toContain('Kept in a cookie');
  });

  test('draws nothing kept for a visitor with no cookie', async ({ request }) => {
    const token = await mintPreview(request, subject.origin, drawsFavourite);
    const html = await (await request.get(previewUrl(subject.origin, token))).text();

    expect(html).not.toContain('Kept in a cookie');
  });

  test('hydrates onto what the server drew', async ({ page, request }) => {
    const problems: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        problems.push(message.text());
      }
    });
    page.on('pageerror', error => problems.push(error.message));

    const [name, value] = painted({ favourite: 'Kept in a cookie' }).split('=');
    await page.context().addCookies([{ name, value, url: subject.origin }]);
    const token = await mintPreview(request, subject.origin, drawsFavourite);

    await page.goto(previewUrl(subject.origin, token));

    await expect(page.getByRole('heading', { name: 'Kept in a cookie' })).toBeVisible();
    expect(problems, 'hydration reported a problem').toEqual([]);
  });
});
