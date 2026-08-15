import { readOfflineData } from '@plitzi/example-space';

import { describeTarget, expect, test } from '../../fixtures';
import { openHarness, renderSpace } from '../../helpers/harness';
import { element, expectSharedSpace } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

/** Viewports a space is actually looked at on. A layout that only holds at 1280px is a layout that breaks for most
 *  of the people who see it, and nothing below the browser can tell you that. */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 }
];

describeTarget('harness', () => {
  test('renders the shared space it boots with', async ({ page, capture }) => {
    await openHarness(page);

    await expectSharedSpace(page);
    await expectVisuallyHealthy(page);

    await capture('default');
  });

  for (const viewport of VIEWPORTS) {
    test(`holds together at ${viewport.name}`, async ({ page, capture }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHarness(page);

      await expectSharedSpace(page);
      await expectVisuallyHealthy(page);

      await capture(viewport.name);
    });
  }

  /** What the harness exists for: a space that is not on disk anywhere, rendered on demand. Everything an agent or
   *  a maintainer wants to look at — a reported schema, a one-off reproduction, a variant under test — arrives
   *  this way, so the path itself is worth a test of its own. */
  test('renders a space handed to it at runtime', async ({ page, capture }) => {
    await openHarness(page);

    const data = readOfflineData();
    const heading = data.schema.flat['65522cc49b57167ea7a2a076'];

    await renderSpace(page, {
      ...data,
      schema: {
        ...data.schema,
        flat: {
          ...data.schema.flat,
          '65522cc49b57167ea7a2a076': {
            ...heading,
            attributes: { ...heading.attributes, content: 'Rendered from a spec' }
          }
        }
      }
    });

    await expect(page.getByRole('heading', { name: 'Rendered from a spec' })).toBeVisible();
    await expect(element(page, '65522cc49b57167ea7a2a076')).toHaveText('Rendered from a spec');

    await expectVisuallyHealthy(page);

    await capture('runtime-schema');
  });
});
