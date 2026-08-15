import { describeTarget, test } from '../../fixtures';
import { openHarness } from '../../helpers/harness';
import { expectSampleSpaceContent, expectSpaceRendered } from '../../helpers/space';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';
import { sampleSpace } from '../../spaces';

/** Sizes a space is actually looked at on. A layout that only holds at 1440px is a layout that breaks for most of
 *  the people who see it, and nothing below a browser can tell you that. */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 }
];

describeTarget('harness', () => {
  for (const viewport of VIEWPORTS) {
    test(`holds together at ${viewport.name}`, async ({ page, capture }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHarness(page);

      await expectSampleSpaceContent(page);
      await expectSpaceRendered(page, sampleSpace());
      await expectVisuallyHealthy(page);

      await capture(viewport.name);
    });
  }
});
