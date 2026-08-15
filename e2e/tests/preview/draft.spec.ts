import { describeTarget, expect, test } from '../../fixtures';
import { mintPreview, previewUrl, PREVIEW_SECRET } from '../../helpers/preview';
import { SAMPLE_IDS } from '../../spaces';

/** Draft preview closes the agent loop: edits are rendered WITHOUT being saved, and a normal page request carrying
 *  the token serves that render once. Asserting it on a visible element rather than on a settings field is the
 *  point — what has to be true is that a person looking at the page sees the draft. */
describeTarget('server', subject => {
  const draftHeading = (content: string) => [
    { type: 'patchElement', pageRef: SAMPLE_IDS.page, ref: SAMPLE_IDS.mainHeading, props: { content } }
  ];

  test('renders an unsaved edit', async ({ page, request, capture }) => {
    const token = await mintPreview(request, subject.origin, draftHeading('Drafted heading'));

    await page.goto(previewUrl(subject.origin, token));

    await expect(page.getByRole('heading', { name: 'Drafted heading' })).toBeVisible();

    await capture('draft');
  });

  test('spends the token: the second render is the saved space', async ({ page, request }) => {
    const token = await mintPreview(request, subject.origin, draftHeading('One shot only'));

    await page.goto(previewUrl(subject.origin, token));
    await expect(page.getByRole('heading', { name: 'One shot only' })).toBeVisible();

    await page.goto(previewUrl(subject.origin, token));

    await expect(page.getByRole('heading', { name: 'One shot only' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();
  });

  test('leaves the space it drafted from untouched', async ({ page, request }) => {
    await mintPreview(request, subject.origin, draftHeading('Never saved'));

    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Never saved' })).toBeHidden();
  });

  test('refuses a caller with no secret', async ({ request }) => {
    const response = await request.post(`${subject.origin}/__preview`, {
      headers: { 'content-type': 'application/json' },
      data: { spaceId: 1, operations: [] }
    });

    expect(response.status(), 'preview minted a draft for an unauthenticated caller').toBeGreaterThanOrEqual(400);
  });

  test('refuses a caller with the wrong secret', async ({ request }) => {
    const response = await request.post(`${subject.origin}/__preview`, {
      headers: { 'content-type': 'application/json', 'x-preview-secret': `${PREVIEW_SECRET}-wrong` },
      data: { spaceId: 1, operations: [] }
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
