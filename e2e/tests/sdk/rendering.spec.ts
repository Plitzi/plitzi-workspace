import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { expectSampleSpaceContent, expectSpaceRendered } from '../../helpers/space';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';
import { minimalSpace, MINIMAL_IDS, SAMPLE_IDS, sampleSpace, sampleSpaceWith } from '../../spaces';

/** The SDK rendering in a browser, with no server anywhere in the picture. Everything here goes through the
 *  harness, which renders whatever schema it is handed — so a failure is the renderer's, never a server's. */
describeTarget('harness', () => {
  test('renders the sample space completely', async ({ page, capture }) => {
    await openHarness(page);

    await expectSampleSpaceContent(page);
    await expectSpaceRendered(page, sampleSpace());
    await expectVisuallyHealthy(page);

    await capture('sample-space');
  });

  test('renders a space that exists only in this test', async ({ page, capture }) => {
    await openHarness(page);
    await renderSpace(page, minimalSpace({ heading: 'Built in a spec', body: 'Two elements, no fixture file.' }));

    await expect(page.getByRole('heading', { name: 'Built in a spec' })).toBeVisible();
    await expect(page.getByText('Two elements, no fixture file.')).toBeVisible();

    await expectSpaceRendered(page, minimalSpace());
    await capture('minimal-space');
  });

  test('re-renders when the schema changes underneath it', async ({ page }) => {
    await openHarness(page);
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

    await renderSpace(page, sampleSpaceWith(SAMPLE_IDS.mainHeading, { content: 'Second render' }));

    await expect(page.getByRole('heading', { name: 'Second render' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeHidden();
  });

  /** The style cache is the space's own CSS. A rule that reaches the page is the difference between a design and a
   *  stack of unstyled divs, and it is invisible to anything that only inspects the DOM. */
  test('applies the space style, not just the markup', async ({ page }) => {
    await openHarness(page);
    await renderSpace(page, minimalSpace({ css: `.${MINIMAL_IDS.heading}{color:rgb(1, 2, 3);}` }));

    const heading = page.getByRole('heading', { name: 'Minimal space' });
    await expect(heading).toBeVisible();

    const rendered = await heading.evaluate(node => getComputedStyle(node).color);

    expect(rendered, 'the space stylesheet never reached the page').toBe('rgb(1, 2, 3)');
  });
});
