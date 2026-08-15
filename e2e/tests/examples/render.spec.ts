import { describeTarget, test } from '../../fixtures';
import { expectSharedSpace } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

describeTarget('render', subject => {
  test('renders the space from a bundled app with no server', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSharedSpace(page);
    await expectVisuallyHealthy(page);

    await capture('offline-render');
  });
});
