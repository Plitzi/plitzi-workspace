import { describeTarget, expect, test } from '../../../fixtures';
import { mintPreview, previewUrl } from '../../../helpers/preview';

/**
 * A page is sent with the plugins it draws; the rest wait for a page that draws them. The server only renders the
 * first page — every page after it is the browser's — so what this has to show is a page reached by navigating, not by
 * loading it, drawing a plugin its first page never asked for.
 */
describeTarget('server', subject => {
  const PROBES = /\/sdk-plugins\/(serverInfo|clientInfo|sharedInfo)/;

  test('loads only the plugins a page draws, and the rest when a page that draws them is opened', async ({
    page,
    request
  }) => {
    const token = await mintPreview(request, subject.origin, [
      { type: 'upsertPage', ref: 'plain', slug: 'plain' },
      {
        type: 'upsertElement',
        pageRef: 'plain',
        element: { ref: 'toHome', type: 'link', props: { mode: 'page', href: 'home', content: 'Back home' } }
      }
    ]);
    const errors: string[] = [];
    const probes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', asked => {
      if (PROBES.test(asked.url())) {
        probes.push(asked.url());
      }
    });

    await page.goto(previewUrl(subject.origin, token, '/plain'), { waitUntil: 'networkidle' });

    expect(probes, 'a page that draws no probe loaded one').toEqual([]);
    expect(await page.locator('link[data-plitzi-plugin]').count()).toBe(0);

    // Set on this document: still there after the click only if the browser navigated without loading a page.
    await page.evaluate(() => {
      (window as Window & { __sameDocument?: boolean }).__sameDocument = true;
    });
    await page.getByRole('link', { name: 'Back home' }).click();

    await expect(page.locator('[data-probe="server"]')).toContainText('rsc:server');
    await expect(page.locator('[data-probe="client"]')).toContainText('rsc:client');
    await expect(page.locator('[data-probe="shared"]')).toContainText('rsc:shared');
    expect(await page.evaluate(() => (window as Window & { __sameDocument?: boolean }).__sameDocument)).toBe(true);
    expect(probes.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
