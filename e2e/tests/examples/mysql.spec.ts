import { describeTarget, expect, test } from '../../fixtures';

/** The same two pages as the in-memory sessions example, over a real account store. Identical assertions on
 *  purpose: the point of the example is that swapping the store changes nothing a visitor can see. */
describeTarget('mysql', subject => {
  test('signs in against the MySQL account store', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await page.getByLabel('Username').fill('ada');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'ada' })).toBeVisible();

    await capture('signed-in');
  });
});
