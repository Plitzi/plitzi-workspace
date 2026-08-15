import { describeTarget, test } from '../../fixtures';
import { expectSharedSpace } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

/** The lowest bar Plitzi sets itself: a static file, opened in a browser, showing a space. Nothing is compiled
 *  here, so a failure means the shipped bundle is broken rather than the build that produced it. */
describeTarget('no-build', subject => {
  test('renders the space from a plain HTML file', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSharedSpace(page);
    await expectVisuallyHealthy(page);

    await capture('no-build');
  });
});
