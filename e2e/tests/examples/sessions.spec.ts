import { describeTarget, expect, test } from '../../fixtures';
import { expectVisuallyHealthy } from '../../helpers/visualHealth';

/** Two pages share `/` and differ by `accessLevel`; who is looking decides which one the router picks. That is the
 *  whole mechanism, and it is only observable end to end — a signed-out visitor and a signed-in one asking for the
 *  same URL have to get different pages back. */
describeTarget('sessions', subject => {
  test('shows the sign-in page to a visitor', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    await expectVisuallyHealthy(page);

    await capture('signed-out');
  });

  test('signs in, shows who is looking, and signs out again', async ({ page, capture }) => {
    await page.goto(subject.origin);

    await page.getByLabel('Username').fill('ada');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The heading and the paragraph are BOUND to the session — seeing the account's own details on screen is what
    // proves the server resolved the identity, not just that a cookie was set.
    await expect(page.getByRole('heading', { name: 'ada' })).toBeVisible();
    await expect(page.getByText('ada@example.test')).toBeVisible();

    await capture('signed-in');

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('refuses the wrong password', async ({ request }) => {
    const response = await request.post(`${subject.origin}/auth/login`, {
      data: { username: 'ada', password: 'not-the-password' }
    });

    expect(response.status(), 'a bad password was accepted').toBeGreaterThanOrEqual(400);
  });
});
