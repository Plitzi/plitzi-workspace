import { describeTarget, expect, test } from '../../fixtures';
import { expectSharedSpace } from '../../helpers/sharedSpace';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

/** What this example claims over the previous one is that the space is an ordinary React child: it re-renders with
 *  the host's state and unmounts like anything else. Both claims are exercised here, because "it mounted once" is
 *  the easy half — a space that leaks on unmount or ignores a changed prop still passes that. */
describeTarget('react-component', subject => {
  test('renders inside a host React tree', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expectSharedSpace(page);
    await expectVisuallyHealthy(page);

    await capture('inside-host-app');
  });

  test('unmounts and mounts again with the host', async ({ page }) => {
    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

    await page.getByRole('button', { name: 'Unmount Plitzi' }).click();
    await expect(page.getByText('Plitzi is unmounted.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeHidden();

    await page.getByRole('button', { name: 'Mount Plitzi' }).click();

    await expectSharedSpace(page);
  });

  test('follows the environment the host selects', async ({ page }) => {
    await page.goto(subject.origin);
    await expect(page.getByRole('heading', { name: 'Welcome To Plitzi' })).toBeVisible();

    await page.getByLabel('environment').selectOption('staging');

    await expectSharedSpace(page);
  });
});
